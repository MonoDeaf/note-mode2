export function sendTaskCompleteNotification(taskTitle) {
  if (Notification.permission === 'granted') {
    new Notification('Timer Complete!', {
      body: `Time's up for task: ${taskTitle}`,
      icon: '/smart-task/3079254-512.png'
    });
  }
}