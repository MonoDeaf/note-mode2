export class TaskManager {
  constructor(storage) {
    this.storage = storage;
    this.groups = new Map();
    this.currentGroup = null;
    this.database = null;
    this.currentUser = null;
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
      
      if (data && data.groups) {
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
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      throw error;
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
      if (!group.notes) {
        group.notes = new Map();
      }
      group.notes.set(note.id, note);
      this.saveData();
    }
    return note;
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
      )
    };

    try {
      await window.set(userDataRef, data);
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  }

  deleteGroup(groupId) {
    this.groups.delete(groupId);
    this.saveData();
  }

  deleteNote(groupId, noteId) {
    const group = this.groups.get(groupId);
    if (group && group.notes) {
      group.notes.delete(noteId);
      this.saveData();
    }
  }

  saveNoteContent(groupId, noteId, content) {
    const group = this.groups.get(groupId);
    if (group && group.notes) {
      const note = group.notes.get(noteId);
      if (note) {
        note.notes = content;
        this.saveData();
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
}