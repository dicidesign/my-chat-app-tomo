// 【client.js 最新・決定版】

// サーバーに接続
const socket = io();

// HTMLから操作したい要素を取得
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const imageInput = document.getElementById('image-input');

// sessionStorageからユーザー名を取得
const storedUsername = sessionStorage.getItem('chatUsername');

if (!storedUsername) {
    alert('ログインしていません。ログインページに戻ります。');
    window.location.href = '/login.html';
} else {
    let currentUsername = storedUsername;

    const displayMessage = (data) => {
        if (!data || typeof data.text !== 'string' || typeof data.username !== 'string') {
            console.error('[displayMessage] データ形式が不正です。スキップします。', data);
            return;
        }

        const item = document.createElement('li');

        const scrollToBottom = () => item.scrollIntoView({ behavior: 'smooth', block: 'end' });

        if (data.isImage) {
            const img = document.createElement('img');
            img.src = data.text;
            
            img.addEventListener('click', () => {
                Swal.fire({
                    imageUrl: img.src,
                    imageAlt: '拡大画像',
                    background: '#000000a0',
                    backdrop: true,
                    showCloseButton: true,
                    showConfirmButton: true,
                    confirmButtonText: '<i class="fas fa-download"></i> ダウンロード',
                    confirmButtonAriaLabel: 'ダウンロード',
                    showCancelButton: false,
                    preConfirm: () => {
                        const link = document.createElement('a');
                        link.href = img.src;
                        link.download = `chat-image-${Date.now()}.jpg`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        return false;
                    },
                    customClass: {
                        popup: 'fullscreen-swal'
                    }
                });
            });
            
            img.onload = scrollToBottom;
            if (img.complete) scrollToBottom();
            
            item.appendChild(img);
        } else {
            item.textContent = data.text;
        }

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

        if (!data.isImage) {
            scrollToBottom();
        }
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
        const lastMessage = messages.lastElementChild;
        if (lastMessage) lastMessage.scrollIntoView({ block: 'end' });
    });

    socket.on('chat message', (data) => {
        displayMessage(data);
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const previewImageUrl = event.target.result;
            Swal.fire({
                title: 'この画像を送信しますか？',
                imageUrl: previewImageUrl,
                imageWidth: '90%',
                imageAlt: '画像プレビュー',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: '送信する',
                cancelButtonText: 'やめる'
            }).then((result) => {
                if (result.isConfirmed) {
                    uploadImage(file);
                } else {
                    imageInput.value = '';
                }
            });
        };
        reader.readAsDataURL(file);
    });

    async function uploadImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        input.disabled = true;
        input.placeholder = '画像をアップロード中...';
        try {
            const response = await fetch('/upload-image', {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || 'サーバーでのアップロードに失敗しました。');
            }
            const result = await response.json();
            const imageUrl = result.imageUrl;
            const messageData = {
                message: imageUrl,
                username: currentUsername,
                isImage: true
            };
            socket.emit('chat message', messageData);
        } catch (error) {
            console.error('画像アップロードに失敗しました:', error);
            alert('画像アップロードに失敗しました。');
        } finally {
            input.disabled = false;
            input.placeholder = 'メッセージを入力';
            imageInput.value = '';
        }
    }
}