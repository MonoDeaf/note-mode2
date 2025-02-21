export class Timer {
  constructor() {
    this.minutes = 25;
    this.seconds = 0;
    this.totalSeconds = this.minutes * 60;
    this.remainingSeconds = this.totalSeconds;
    this.isRunning = false;
    this.interval = null;

    this.elements = {
      display: document.querySelector('.timer-display'),
      progress: document.querySelector('.timer-progress'),
      startBtn: document.querySelector('.timer-btn.start'),
      pauseBtn: document.querySelector('.timer-btn.pause'),
      resetBtn: document.querySelector('.timer-btn.reset'),
      minutesInput: document.querySelector('#timer-minutes')
    };

    this.initialize();
  }

  initialize() {
    this.elements.startBtn.addEventListener('click', () => this.start());
    this.elements.pauseBtn.addEventListener('click', () => this.pause());
    this.elements.resetBtn.addEventListener('click', () => this.reset());
    this.elements.minutesInput.addEventListener('change', (e) => {
      const value = parseInt(e.target.value);
      if (value > 0 && value <= 60) {
        this.minutes = value;
        this.totalSeconds = this.minutes * 60;
        this.remainingSeconds = this.totalSeconds;
        this.updateDisplay();
      }
    });

    this.updateDisplay();
  }

  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.elements.startBtn.disabled = true;
      this.elements.pauseBtn.disabled = false;
      this.elements.resetBtn.disabled = false;
      this.elements.minutesInput.disabled = true;

      this.interval = setInterval(() => {
        this.remainingSeconds--;
        this.updateDisplay();

        if (this.remainingSeconds <= 0) {
          this.complete();
        }
      }, 1000);
    }
  }

  pause() {
    if (this.isRunning) {
      this.isRunning = false;
      clearInterval(this.interval);
      this.elements.startBtn.disabled = false;
      this.elements.pauseBtn.disabled = true;
    }
  }

  reset() {
    this.isRunning = false;
    clearInterval(this.interval);
    this.remainingSeconds = this.totalSeconds;
    this.elements.startBtn.disabled = false;
    this.elements.pauseBtn.disabled = true;
    this.elements.resetBtn.disabled = true;
    this.elements.minutesInput.disabled = false;
    this.updateDisplay();
  }

  complete() {
    this.isRunning = false;
    clearInterval(this.interval);
    this.elements.startBtn.disabled = false;
    this.elements.pauseBtn.disabled = true;
    this.elements.resetBtn.disabled = false;
    this.elements.minutesInput.disabled = false;
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Timer Complete!', {
        body: 'Your timer has finished.',
        icon: '/icons/icon-512x512.png'
      });
    }
  }

  updateDisplay() {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    this.elements.display.textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const progress = (this.remainingSeconds / this.totalSeconds) * 283;
    this.elements.progress.style.strokeDashoffset = 283 - progress;
  }
}