import axios from 'axios';

export async function sendChatAlert(message: string, type: 'blocker' | 'overload' | 'progress' | 'info') {
  const colors = {
    blocker: '#E24B4A',
    overload: '#EF9F27',
    progress: '#1D9E75',
    info: '#534AB7',
  };

  const payload = {
    cards: [{
      header: {
        title: 'PM Dashboard Alert',
        subtitle: new Date().toLocaleString(),
      },
      sections: [{
        widgets: [{
          textParagraph: { text: `<font color="${colors[type]}"><b>${type.toUpperCase()}</b></font>: ${message}` }
        }]
      }]
    }]
  };

  await axios.post(process.env.GOOGLE_CHAT_WEBHOOK_URL!, payload);
}