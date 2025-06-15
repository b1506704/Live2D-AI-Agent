// Utility to escape HTML and replace emotes with emojis
export function escapeAndEmote(text) {
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const emotes = {
    ':)': '😊', ':(': '😢', ':D': '😃', ';)' : '😉', ':P': '😛', '<3': '❤️', 'xD': '😆'
  };
  Object.entries(emotes).forEach(([emote, emoji]) => {
    const escapedEmote = emote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    escaped = escaped.replace(new RegExp(escapedEmote, 'g'), emoji);
  });
  return escaped;
}
