// サーバーに接続
const socket = io();

// HTMLから操作したい要素を取得
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

// sessionStorageからユーザー名を取得
const storedUsername = sessionStorage.getItem('chatUsername');

if (!storedUsername) {
    // 【ユーザー名がない場合】
    alert('ログインしていません。ログインページに戻ります。');
    window.location.href = '/login.html'; 
} else {
    // 【ユーザー名がある場合】
    
    let currentUsername = storedUsername;

    const displayMessage = (data) => {
        if (!data || typeof data.text !== 'string' || typeof data.username !== 'string') {
            console.error('[displayMessage] データ形式が不正です。スキップします。', data);
            return;
        }

        const item = document.createElement('li');
        item.textContent = data.text;

        if (data.username === currentUsername) {
            item.classList.add('me');
            messages.appendChild(item);
        } else {
            const nameLabel = document.createElement('div');
            nameLabel.textContent = data.username;
            nameLabel.className = 'name-label';
            item.classList.add('opponent');
            messages.appendChild(nameLabel);
            messages.appendChild(item);
        }
        window.scrollTo(0, document.body.scrollHeight);
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (input.value) {
            const messageData = {
                message: input.value,
                username: currentUsername
            };
            socket.emit('chat message', messageData);
            input.value = '';
        }
    });

    socket.on('load old messages', (serverMessages) => {
        messages.innerHTML = '';
        serverMessages.forEach(msg => {
            displayMessage(msg);
        });
    });

    socket.on('chat message', (data) => {
        displayMessage(data);
    });
}