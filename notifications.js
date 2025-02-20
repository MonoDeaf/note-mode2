export class NotificationManager {
  constructor() {
    this.initialized = false;
    this.settings = this.loadSettings();
    this.timers = new Map();
  }

  loadSettings() {
    const defaultSettings = {
      enabled: false,
      dailyReminder: false,
      reminderTime: '09:00',
      groupReminders: false,
      inactivityThreshold: 7
    };
    
    const saved = localStorage.getItem('notificationSettings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  }

  saveSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    localStorage.setItem('notificationSettings', JSON.stringify(this.settings));
    this.updateNotificationSchedule();
  }

  async initialize() {
    if (this.initialized) return;

    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.initialized = true;
        this.updateNotificationSchedule();
      }
    }
  }

  updateNotificationSchedule() {
    // Clear existing timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    if (!this.settings.enabled) return;

    // Schedule daily reminder
    if (this.settings.dailyReminder) {
      this.scheduleDailyReminder();
    }

    // Schedule group inactivity checks
    if (this.settings.groupReminders) {
      this.scheduleGroupInactivityChecks();
    }
  }

  scheduleDailyReminder() {
    const [hours, minutes] = this.settings.reminderTime.split(':');
    const now = new Date();
    const reminderTime = new Date(now);
    reminderTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }

    const delay = reminderTime.getTime() - now.getTime();
    const timerId = setTimeout(() => {
      this.showNotification('Daily Reminder', 'Time to write some notes! 😁');
      this.scheduleDailyReminder(); // Schedule next reminder
    }, delay);

    this.timers.set('dailyReminder', timerId);
  }

  scheduleGroupInactivityChecks() {
    // Check groups every day
    const checkGroups = () => {
      const groups = window.taskManager.groups;
      const threshold = this.settings.inactivityThreshold * 24 * 60 * 60 * 1000; // Convert days to ms
      
      groups.forEach(group => {
        const lastNote = Array.from(group.notes.values())
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        
        if (lastNote) {
          const timeSinceLastNote = Date.now() - new Date(lastNote.createdAt).getTime();
          if (timeSinceLastNote >= threshold) {
            this.showNotification(
              'Group Reminder',
              `You haven't added notes to "${group.name}" in a while! 👀`
            );
          }
        }
      });
    };

    // Check once per day
    const timerId = setInterval(checkGroups, 24 * 60 * 60 * 1000);
    this.timers.set('groupChecks', timerId);
    
    // Also check immediately
    checkGroups();
  }

  showNotification(title, body) {
    if (!this.initialized || !this.settings.enabled) return;

    new Notification(title, {
      body,
      icon: '/icons/icon-512x512.png',
      badge: '/icon/icon-512x512.png',
      requireInteraction: false,
      silent: false
    });
  }

  sendTaskCompleteNotification(taskTitle) {
    this.showNotification('Timer Complete!', `Time's up for task: ${taskTitle}`);
  }
}