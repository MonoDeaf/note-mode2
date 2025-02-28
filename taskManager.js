export class TaskManager {
  constructor(storage) {
    this.storage = storage;
    this.groups = new Map();
    this.currentGroup = null;
    this.database = null;
    this.currentUser = null;
    this.groupOrder = []; // Add this to track group order
  }

  setCurrentUser(user) {
    this.currentUser = user;
    this.database = window.getDatabase();
    if (user) {
      this.loadUserData();
    } else {
      this.groups.clear();
      this.currentGroup = null;
    }
  }

  async loadUserData() {
    if (!this.currentUser) return;

    const userDataRef = window.ref(this.database, `users/${this.currentUser.uid}/data`);
    try {
      const snapshot = await window.get(userDataRef);
      const data = snapshot.val();
      
      this.groups.clear();
      this.groupOrder = []; // Reset group order
      
      if (data && data.groups) {
        // First load the groups
        Object.entries(data.groups).forEach(([groupId, group]) => {
          const notesMap = new Map();
          if (group.notes) {
            Object.entries(group.notes).forEach(([noteId, note]) => {
              notesMap.set(noteId, {
                ...note,
                id: noteId,
                createdAt: new Date(note.createdAt)
              });
            });
          }
          
          this.groups.set(groupId, {
            id: groupId,
            name: group.name,
            background: group.background,
            notes: notesMap
          });
        });

        // Then set the order - either from saved order or create default
        if (data.groupOrder) {
          this.groupOrder = data.groupOrder;
        } else {
          this.groupOrder = Array.from(this.groups.keys());
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      throw error;
    }
  }

  async saveData() {
    if (!this.currentUser) return;

    const userDataRef = window.ref(this.database, `users/${this.currentUser.uid}/data`);
    const data = {
      groups: Object.fromEntries(
        Array.from(this.groups.entries()).map(([id, group]) => [
          id,
          {
            id: group.id,
            name: group.name,
            background: group.background,
            notes: Object.fromEntries(
              Array.from(group.notes || new Map()).map(([noteId, note]) => [
                noteId,
                {
                  ...note,
                  createdAt: note.createdAt.toISOString()
                }
              ])
            )
          }
        ])
      ),
      groupOrder: this.groupOrder // Save the group order
    };

    try {
      await window.set(userDataRef, data);
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  }

  createGroup(name, background) {
    const group = {
      id: Date.now().toString(),
      name,
      background: background || { type: 'color', value: '#ffffff' }, 
      notes: new Map()
    };
    this.groups.set(group.id, group);
    this.groupOrder.unshift(group.id); // Add new group to start of order
    this.saveData();
    return group;
  }

  createNote(groupId, title) {
    const note = {
      id: Date.now().toString(),
      title,
      createdAt: new Date(),
      notes: ''
    };
    
    const group = this.groups.get(groupId);
    if (group) {
      // Ensure notes Map exists
      if (!group.notes) {
        group.notes = new Map();
      }
      
      // Check if this exact note already exists
      const existingNote = Array.from(group.notes.values()).find(n => 
        n.title === title && 
        Math.abs(new Date(n.createdAt) - new Date()) < 1000 // Within 1 second
      );
      
      if (!existingNote) {
        group.notes.set(note.id, note);
        this.saveData();
        return note;
      }
      return existingNote;
    }
    return null;
  }

  deleteGroup(groupId) {
    this.groups.delete(groupId);
    this.groupOrder = this.groupOrder.filter(id => id !== groupId);
    this.saveData();
  }

  moveGroup(groupId, direction) {
    const currentIndex = this.groupOrder.indexOf(groupId);
    if (currentIndex === -1) return false;

    const newIndex = direction === 'left' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(this.groupOrder.length - 1, currentIndex + 1);

    if (currentIndex === newIndex) return false;

    // Remove from current position and insert at new position
    this.groupOrder.splice(currentIndex, 1);
    this.groupOrder.splice(newIndex, 0, groupId);
    this.saveData();
    return true;
  }

  deleteNote(groupId, noteId) {
    const group = this.groups.get(groupId);
    if (group && group.notes) {
      group.notes.delete(noteId);
      this.saveData();
    }
  }

  async saveNoteContent(groupId, noteId, content) {
    const group = this.groups.get(groupId);
    if (group && group.notes) {
      const note = group.notes.get(noteId);
      if (note) {
        note.notes = content;
        // Save to local storage and Firebase
        await this.saveData();
      }
    }
  }

  getNoteContent(groupId, noteId) {
    const group = this.groups.get(groupId);
    if (group && group.notes) {
      const note = group.notes.get(noteId);
      if (note) {
        return note.notes || '';
      }
    }
    return '';
  }

  getAllNoteStats() {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    // Initialize last 7 days
    const lastWeek = new Array(7).fill(0).map((_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      return date;
    }).reverse();

    const stats = lastWeek.map(date => {
      let created = 0;
      let total = 0;

      // Start and end of the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      this.groups.forEach(group => {
        group.notes.forEach(note => {
          const noteDate = new Date(note.createdAt);
          
          // Count notes created on this day
          if (noteDate >= startOfDay && noteDate <= endOfDay) {
            created++;
          }
          
          // Count total notes up to this day
          if (noteDate <= endOfDay) {
            total++;
          }
        });
      });

      return {
        date: date.toLocaleDateString(),
        created,
        total
      };
    });

    return stats;
  }

  getTotalStats() {
    let totalNotes = 0;
    const hourlyActivity = new Array(8).fill(0);
    const weekdayActivity = new Array(7).fill(0);
    const activeHours = new Map();
    const activeDays = new Map();
    let longestStreak = 0;
    let currentStreak = 0;
    let lastDate = null;

    // Sort all notes by creation date
    const allNotes = [];
    this.groups.forEach(group => {
      group.notes.forEach(note => {
        allNotes.push(note);
        totalNotes++;

        const date = new Date(note.createdAt);
        const hour = Math.floor(date.getHours() / 3); // Group into 3-hour blocks
        const day = date.getDay();
        const dateStr = date.toDateString();

        // Update hourly activity
        hourlyActivity[hour]++;

        // Update weekday activity
        weekdayActivity[day]++;

        // Track active hours and days
        activeHours.set(hour, (activeHours.get(hour) || 0) + 1);
        activeDays.set(day, (activeDays.get(day) || 0) + 1);

        // Update streak calculation
        if (lastDate) {
          const dayDiff = Math.floor((date - lastDate) / (1000 * 60 * 60 * 24));
          if (dayDiff === 1) {
            currentStreak++;
            longestStreak = Math.max(longestStreak, currentStreak);
          } else if (dayDiff > 1) {
            currentStreak = 0;
          }
        }
        lastDate = date;
      });
    });

    // Find most active day and hour
    let mostActiveDay = 'Sunday';
    let maxDayActivity = 0;
    activeDays.forEach((count, day) => {
      if (count > maxDayActivity) {
        maxDayActivity = count;
        mostActiveDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
      }
    });

    let peakActivityTime = '12 AM - 3 AM';
    let maxHourActivity = 0;
    activeHours.forEach((count, hour) => {
      if (count > maxHourActivity) {
        maxHourActivity = count;
        peakActivityTime = `${hour * 3}:00 - ${(hour + 1) * 3}:00`;
      }
    });

    return {
      total: totalNotes,
      mostActiveDay,
      peakActivityTime,
      longestStreak: Math.max(currentStreak, longestStreak, 1), // Minimum streak of 1
      hourlyActivity,
      weekdayActivity
    };
  }

  getGroupStats(groupId) {
    const group = this.groups.get(groupId);
    if (!group) return null;

    const today = new Date();
    const lastWeek = new Array(7).fill(0).map((_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      return date;
    }).reverse();

    const stats = lastWeek.map(date => {
      const notesUpToDate = Array.from(group.notes.values()).filter(note => 
        new Date(note.createdAt) <= date
      );

      const created = Array.from(group.notes.values()).filter(note =>
        new Date(note.createdAt).toDateString() === date.toDateString()
      ).length;

      return {
        date: date.toLocaleDateString(),
        created,
        total: notesUpToDate.length
      };
    });

    return stats;
  }

  getGroupEditStats(groupId) {
    const group = this.groups.get(groupId);
    if (!group) return null;

    const stats = {
      totalCharacters: 0,
      averageCharactersPerNote: 0,
      textEditsByHour: new Array(24).fill(0),
      charactersByDay: new Array(7).fill(0),
      editHistory: []
    };

    if (group.notes) {
      let totalNotes = 0;
      
      group.notes.forEach(note => {
        const noteLength = note.notes ? note.notes.length : 0;
        stats.totalCharacters += noteLength;
        totalNotes++;

        const createdAt = new Date(note.createdAt);
        stats.textEditsByHour[createdAt.getHours()]++;
        stats.charactersByDay[createdAt.getDay()] += noteLength;

        stats.editHistory.push({
          date: createdAt.toISOString().split('T')[0],
          characters: noteLength
        });
      });

      stats.averageCharactersPerNote = totalNotes > 0 ? 
        Math.round(stats.totalCharacters / totalNotes) : 0;
    }

    return stats;
  }
}