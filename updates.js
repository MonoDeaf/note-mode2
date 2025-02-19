export const updates = [
  {
    version: "0.5.0",
    title: "Initial Release",
    personalMessage: "Hey everyone! I'm excited to introduce Note Mode. This web application focuses on improving the note-taking experience with rich text editing and better organization. Search for notes and content inside of notes. Users can share notes with other users as well! Inside of a group, select the download icon, send the file to a friend with Note Mode installed, and have them upload the file into a group. New features, updates and fixes will be rolled out periodically to keep the notes flowing smoothly. I hope you enjoy Note Mode! - MonoDeaf",
    updates: [
      
    ],
    knownIssues: [
     
    ],
    fixes: [
      
    ]
  }
];

export function getLatestVersion() {
  return updates[0].version;
}

export function getLastSeenVersion() {
  return localStorage.getItem('lastSeenVersion') || '0.0.0';
}

export function setLastSeenVersion(version) {
  localStorage.setItem('lastSeenVersion', version);
}

export function hasNewUpdates() {
  const lastSeen = getLastSeenVersion();
  const latest = getLatestVersion();
  return lastSeen !== latest;
}
