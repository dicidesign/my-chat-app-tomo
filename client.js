// 【client.js 完全版・最終確定・省略なし】

// サーバーに接続
const socket = io();

// HTMLから操作したい要素を取得
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const imageInput = document.getElementById('image-input');

// sessionStorageからユーザー名を取得
const storedUsername = sessionStorage.getItem('chatUsername');

// ログインチェック
if (!storedUsername) {
    alert('ログインしていません。ログインページに戻ります。');
    window.location.href = '/login.html';
} else {
    // --- ログイン済みの場合、ここから下のコードが実行される ---

    let currentUsername = storedUsername;
    let lastMessageDate = null;

    const displayMessage = (data) => {
        if (!data || typeof data.text !== 'string' || !data.createdAt) { return; }
        let messageDate;
        if (typeof data.createdAt === 'object' && data.createdAt.seconds) {
            messageDate = new Date(data.createdAt.seconds * 1000);
        } else {
            messageDate = new Date(data.createdAt);
        }
        if (isNaN(messageDate.getTime())) { return; }

        const messageDateString = `${messageDate.getFullYear()}-${messageDate.getMonth()}-${messageDate.getDate()}`;
        if (messageDateString !== lastMessageDate) {
            const dateStampContainer = document.getElementById('date-stamp-container');
            if (dateStampContainer) {
                dateStampContainer.innerHTML = '';
                const dateStamp = document.createElement('div');
                dateStamp.className = 'date-stamp';
                dateStamp.textContent = `${messageDate.getFullYear()}/${String(messageDate.getMonth() + 1).padStart(2, '0')}/${String(messageDate.getDate()).padStart(2, '0')}`;
                dateStampContainer.appendChild(dateStamp);
            }
            lastMessageDate = messageDateString;
        }

        const username = data.username || '名無しさん';
        const li = document.createElement('li');
        li.id = `message-${data.id}`;
        const bubble = document.createElement('div');
        const time = document.createElement('span');

        if (data.isImage === true) {
            const img = document.createElement('img');
            img.src = data.text;
            img.addEventListener('click', () => {
                Swal.fire({
                    html: `<div class="swal-custom-header"><button type="button" class="swal-delete-button" title="削除"><i class="fas fa-trash-alt"></i></button><a href="/download-image?url=${encodeURIComponent(img.src)}" class="swal-download-button" title="ダウンロード"><i class="fas fa-download"></i><span>Download</span></a><button type="button" class="swal2-close swal-close-button" title="閉じる">×</button></div>`,
                    imageUrl: img.src, imageAlt: '拡大画像', padding: 0, background: 'transparent', backdrop: `rgba(0,0,0,0.8)`, showConfirmButton: false,
                    customClass: { popup: 'fullscreen-swal', htmlContainer: 'swal-html-container-custom' },
                    didOpen: (modal) => {
                        modal.querySelector('.swal-close-button').addEventListener('click', () => Swal.close());
                        const deleteButton = modal.querySelector('.swal-delete-button');
                        if (deleteButton) {
                            deleteButton.addEventListener('click', () => {
                                Swal.fire({ title: 'この画像を削除しますか？', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'はい、削除します', cancelButtonText: 'やめる' })
                                .then((result) => {
                                    if (result.isConfirmed) {
                                        if (data.id) { // ← 安全装置
                                            console.log(`[クライアント] 画像削除リクエスト送信: ID = ${data.id}`);
                                            socket.emit('delete message', data.id);
                                            Swal.close();
                                        }
                                    }
                                });
                            });
                        }
                    }
                });
            });
            bubble.appendChild(img);
        } else {
            bubble.textContent = data.text;
        }

        time.textContent = `${String(messageDate.getHours()).padStart(2, '0')}:${String(messageDate.getMinutes()).padStart(2, '0')}`;
        bubble.className = 'bubble';
        time.className = 'message-time';

        if (!data.isImage && username === currentUsername) {
            const showDeleteConfirm = () => {
                Swal.fire({
                    title: 'このメッセージを削除しますか？', text: "この操作は取り消せません。", icon: 'warning',
                    showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
                    confirmButtonText: 'はい、削除します', cancelButtonText: 'やめる'
                }).then((result) => {
                    if (result.isConfirmed) {
                        if (data.id) { // ← 安全装置
                            console.log(`[クライアント] テキスト削除リクエスト送信: ID = ${data.id}`);
                            socket.emit('delete message', data.id);
                        }
                    }
                });
            };
            bubble.addEventListener('click', showDeleteConfirm);
            bubble.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showDeleteConfirm();
            });
        }

        if (username === currentUsername) {
            li.classList.add('me');
            li.appendChild(time);
            li.appendChild(bubble);
        } else {
            const nameLabel = document.createElement('div');
            nameLabel.textContent = username;
            nameLabel.className = 'name-label';
            messages.appendChild(nameLabel);
            li.classList.add('opponent');
            li.appendChild(bubble);
            li.appendChild(time);
        }
        messages.appendChild(li);
    };

    form.addEventListener('submit', (e) => { e.preventDefault(); if (input.value) { socket.emit('chat message', { message: input.value, username: currentUsername, isImage: false }); input.value = ''; } });
    imageInput.addEventListener('change', (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (event) => { Swal.fire({ title: 'この画像を送信しますか？', imageUrl: event.target.result, imageWidth: '90%', imageAlt: '画像プレビュー', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: '送信する', cancelButtonText: 'やめる' }).then((result) => { if (result.isConfirmed) { uploadImage(file); } imageInput.value = ''; }); }; reader.readAsDataURL(file); });
    async function uploadImage(file) { const formData = new FormData(); formData.append('image', file); input.disabled = true; input.placeholder = '画像をアップロード中...'; try { const response = await fetch('/upload-image', { method: 'POST', body: formData }); if (!response.ok) { const errorResult = await response.json(); throw new Error(errorResult.error || 'サーバーでのアップロードに失敗しました。'); } const result = await response.json(); socket.emit('chat message', { message: result.imageUrl, username: currentUsername, isImage: true }); } catch (error) { console.error('画像アップロードに失敗しました:', error); alert('画像アップロードに失敗しました。'); } finally { input.disabled = false; input.placeholder = 'メッセージを入力'; } }

    socket.on('connect', async () => { try { const response = await fetch('/get-theme'); const result = await response.json(); if (result.success && result.theme) { const chatThemeElement = document.querySelector('.chat-theme'); if (chatThemeElement) { chatThemeElement.textContent = result.theme; } } } catch (e) { console.error("テーマの読み込みに失敗しました:", e); } });
    socket.on('load old messages', (serverMessages) => { messages.innerHTML = ''; lastMessageDate = null; serverMessages.forEach(msg => displayMessage(msg)); messages.scrollTop = messages.scrollHeight; });
    socket.on('chat message', (data) => { displayMessage(data); messages.scrollTop = messages.scrollHeight; });

    socket.on('message deleted', (messageId) => {
        const messageElement = document.getElementById(`message-${messageId}`);
        if (messageElement) {
            const nameLabel = messageElement.previousElementSibling;
            if (nameLabel && nameLabel.classList.contains('name-label')) {
                nameLabel.remove();
            }
            messageElement.remove();
        }
    });

    // --- ヘッダーのテーマ変更機能 ---
    const chatThemeElement = document.querySelector('.chat-theme');
    if (chatThemeElement) {
        chatThemeElement.addEventListener('click', () => {
            Swal.fire({
                title: '新しいテーマを入力してください', input: 'text', inputValue: chatThemeElement.textContent, showCancelButton: true,
                confirmButtonText: '変更する', cancelButtonText: 'やめる', inputAttributes: { maxlength: 10 },
                preConfirm: (value) => {
                    if (!value) { Swal.showValidationMessage('テーマを入力してください！'); return false; }
                    if (value.length > 8) { Swal.showValidationMessage('テーマは8文字以内で入力してください。'); return false; }
                    return value;
                },
                allowOutsideClick: () => !Swal.isLoading()
            }).then((result) => {
                if (result.isConfirmed && result.value) {
                    const newTheme = result.value;
                    socket.emit('theme change', newTheme);
                }
            });
        });
    }

    socket.on('theme updated', (newTheme) => {
        if (chatThemeElement) {
            chatThemeElement.textContent = newTheme;
        }
    });
}
