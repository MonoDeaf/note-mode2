import { TaskManager } from './taskManager.js';
import { UIManager } from './uiManager.js';
import { StorageManager } from './storageManager.js';

class App {
  constructor() {
    document.addEventListener('DOMContentLoaded', () => {
      this.storage = new StorageManager();
      this.taskManager = new TaskManager(this.storage);
      this.ui = new UIManager(this.taskManager);
      
      // Make instances globally available
      window.taskManager = this.taskManager;
      window.uiManager = this.ui;
      
      this.init();
    });
  }

  init() {
    this.ui.initializeUI();
  }
}

new App();