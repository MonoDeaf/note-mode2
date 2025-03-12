import { TaskManager } from './taskManager.js';
import { UIManager } from './uiManager.js';
import { StorageManager } from './storageManager.js';
import { NotificationManager } from './notifications.js';

class App {
  constructor() {
    document.addEventListener('DOMContentLoaded', () => {
      this.storage = new StorageManager();
      this.notifications = new NotificationManager();
      this.taskManager = new TaskManager(this.storage);
      this.ui = new UIManager(this.taskManager, this.notifications);
      
      // Make instances globally available
      window.taskManager = this.taskManager;
      window.uiManager = this.ui;
      window.notificationManager = this.notifications;
      
      this.init();
    });
  }

  init() {
    this.ui.initializeUI();
    
    // Initialize notification settings UI
    const notificationToggle = document.getElementById('notifications-toggle');
    const notificationSettings = document.querySelector('.notification-settings');
    const dailyReminderToggle = document.getElementById('daily-reminder-toggle');
    const reminderTime = document.getElementById('reminder-time');
    const groupReminderToggle = document.getElementById('group-reminder-toggle');
    const inactivityThreshold = document.getElementById('inactivity-threshold');

    // Load saved settings
    const settings = this.notifications.settings;
    notificationToggle.checked = settings.enabled;
    dailyReminderToggle.checked = settings.dailyReminder;
    reminderTime.value = settings.reminderTime;
    groupReminderToggle.checked = settings.groupReminders;
    inactivityThreshold.value = settings.inactivityThreshold;
    notificationSettings.style.display = settings.enabled ? 'block' : 'none';

    // Add event listeners
    notificationToggle.addEventListener('change', async (e) => {
      if (e.target.checked) {
        await this.notifications.initialize();
        notificationSettings.style.display = 'block';
      } else {
        notificationSettings.style.display = 'none';
      }
      this.notifications.saveSettings({ enabled: e.target.checked });
    });

    dailyReminderToggle.addEventListener('change', (e) => {
      this.notifications.saveSettings({ dailyReminder: e.target.checked });
    });

    reminderTime.addEventListener('change', (e) => {
      this.notifications.saveSettings({ reminderTime: e.target.value });
    });

    groupReminderToggle.addEventListener('change', (e) => {
      this.notifications.saveSettings({ groupReminders: e.target.checked });
    });

    inactivityThreshold.addEventListener('change', (e) => {
      this.notifications.saveSettings({ inactivityThreshold: parseInt(e.target.value) });
    });
  }
}

new App();