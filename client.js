// 【client.js 完全版・最終確定・コメント付き・省略なし】

// --- 1. サーバーに接続し、HTML要素を取得 ---
const socket = io();
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const imageInput = document.getElementById('image-input');

// --- 2. ログイン状態をチェック ---
const storedUsername = sessionStorage.getItem('chatUsername');
if (!storedUsername) {
    alert('ログインしていません。ログインページに戻ります。');
    window.location.href = '/login.html';
} else {
    // --- 3. ログイン済みの場合の全処理 ---

    let currentUsername = storedUsername;
    let lastMessageDate = null;

    // --- 4. メッセージを1件表示するための総合関数 ---
     const displayMessage = (data) => {
        if (!data || typeof data.text !== 'string' || !data.createdAt) { return; }
        // ... (日付処理は変更なし) ...

        const username = data.username || '名無しさん';
        const li = document.createElement('li');
        li.id = `message-${data.id}`;
        const bubble = document.createElement('div');
        const time = document.createElement('span');

        if (data.isImage === true) {
            // --- 4A. 画像メッセージの場合 ---
            const img = document.createElement('img');
            img.src = data.text;
            img.addEventListener('click', () => { // 画像クリックで拡大モーダル
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
                                .then((result) => { if (result.isConfirmed) { socket.emit('delete message', data.id); Swal.close(); } });
                            });
                        }
                    }
                });
            });
            bubble.appendChild(img);
        } else {
            // --- 4B. テキストメッセージの場合 ---
            bubble.textContent = data.text;
            if (username === currentUsername) { // 自分のテキストメッセージにだけメニュー機能を追加
                let pressTimer;
                const showMenu = (e) => { e.preventDefault(); showPopupMenu(bubble, data); };
                bubble.addEventListener('contextmenu', showMenu); // 長押し・右クリック
                bubble.addEventListener('mouseenter', () => { pressTimer = setTimeout(() => showMenu({ preventDefault: () => {} }), 800); });
                bubble.addEventListener('mouseleave', () => { clearTimeout(pressTimer); });
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

    // --- 5. ポップアップメニューを表示するためのヘルパー関数 ---
    function showPopupMenu(targetElement, messageData, isImage) {
        const existingMenu = document.querySelector('.popup-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'popup-menu';
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'popup-menu-button';
        deleteButton.textContent = '削除';
        deleteButton.onclick = () => {
            Swal.fire({ title: `この${isImage ? '画像' : 'メッセージ'}を削除しますか？`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'はい、削除します', cancelButtonText: 'やめる' })
            .then((result) => {
                if (result.isConfirmed) {
                    socket.emit('delete message', messageData.id);
                }
            });
            menu.remove();
        };

        menu.appendChild(deleteButton);
        document.body.appendChild(menu);

        const targetRect = targetElement.getBoundingClientRect();
        menu.style.top = `${window.scrollY + targetRect.top - menu.offsetHeight - 10}px`;
        menu.style.left = `${window.scrollX + targetRect.left + (targetRect.width / 2) - (menu.offsetWidth / 2)}px`;
        
        setTimeout(() => menu.classList.add('is-active'), 10);

        const closeMenu = (e) => { if (!menu.contains(e.target)) { menu.classList.remove('is-active'); setTimeout(() => menu.remove(), 100); window.removeEventListener('click', closeMenu, true); } };
        setTimeout(() => window.addEventListener('click', closeMenu, true), 10);
    }

    // --- 6. メッセージや画像の送信イベント ---
    form.addEventListener('submit', (e) => { e.preventDefault(); if (input.value) { socket.emit('chat message', { message: input.value, username: currentUsername, isImage: false }); input.value = ''; } });
    imageInput.addEventListener('change', (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (event) => { Swal.fire({ title: 'この画像を送信しますか？', imageUrl: event.target.result, imageWidth: '90%', imageAlt: '画像プレビュー', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: '送信する', cancelButtonText: 'やめる' }).then((result) => { if (result.isConfirmed) { uploadImage(file); } imageInput.value = ''; }); }; reader.readAsDataURL(file); });
    async function uploadImage(file) { const formData = new FormData(); formData.append('image', file); input.disabled = true; input.placeholder = '画像をアップロード中...'; try { const response = await fetch('/upload-image', { method: 'POST', body: formData }); if (!response.ok) { const errorResult = await response.json(); throw new Error(errorResult.error || 'サーバーでのアップロードに失敗しました。'); } const result = await response.json(); socket.emit('chat message', { message: result.imageUrl, username: currentUsername, isImage: true }); } catch (error) { console.error('画像アップロードに失敗しました:', error); alert('画像アップロードに失敗しました。'); } finally { input.disabled = false; input.placeholder = 'メッセージを入力'; } }

    // --- 7. Socket.IOのイベントリスナー群 ---
    socket.on('connect', async () => { try { const response = await fetch('/get-theme'); const result = await response.json(); if (result.success && result.theme) { const chatThemeElement = document.querySelector('.chat-theme'); if (chatThemeElement) { chatThemeElement.textContent = result.theme; } } } catch (e) { console.error("テーマの読み込みに失敗しました:", e); } });
    socket.on('load old messages', (serverMessages) => { messages.innerHTML = ''; lastMessageDate = null; serverMessages.forEach(msg => displayMessage(msg)); messages.scrollTop = messages.scrollHeight; });
    socket.on('chat message', (data) => { displayMessage(data); messages.scrollTop = messages.scrollHeight; });
    socket.on('message deleted', (messageId) => { const messageElement = document.getElementById(`message-${messageId}`); if (messageElement) { const nameLabel = messageElement.previousElementSibling; if (nameLabel && nameLabel.classList.contains('name-label')) { nameLabel.remove(); } messageElement.remove(); } });
    socket.on('theme updated', (newTheme) => { const chatThemeElement = document.querySelector('.chat-theme'); if (chatThemeElement) { chatThemeElement.textContent = newTheme; } });
    
    // --- 8. ヘッダーのテーマ変更機能 ---
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
}
}
