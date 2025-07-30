// 【client.js 完全版・最終確定】

// --- 1. サーバーに接続 ---
const socket = io();

// --- 2. HTML要素をまとめて取得 ---
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const imageInput = document.getElementById('image-input');
const attachmentButton = document.getElementById('attachment-button');
const attachmentMenu = document.getElementById('attachment-menu');
const takePhotoButton = document.getElementById('take-photo-button');
const chooseFileButton = document.getElementById('choose-file-button');
const voiceButton = document.getElementById('voice-button');
const closeMenuButton = document.getElementById('close-menu-button');

// --- 3. ログイン状態をチェック ---
const storedUsername = sessionStorage.getItem('chatUsername');
if (!storedUsername) {
    window.location.href = '/login.html';
} else {
    // --- 4. ログイン済みの場合の全処理 ---
    let currentUsername = storedUsername;
    let lastMessageDate = null;

    // --- 5. メッセージを1件表示するための総合関数 ---
    const displayMessage = (data) => {
        if (!data || typeof data.text !== 'string' || !data.createdAt) { return; }
        let messageDate;
        if (typeof data.createdAt === 'object' && data.createdAt.seconds) { messageDate = new Date(data.createdAt.seconds * 1000); } else { messageDate = new Date(data.createdAt); }
        if (isNaN(messageDate.getTime())) { return; }
        const messageDateString = `${messageDate.getFullYear()}-${messageDate.getMonth()}-${messageDate.getDate()}`;
        if (messageDateString !== lastMessageDate) { const dateStamp = document.createElement('div'); dateStamp.className = 'date-stamp'; dateStamp.textContent = `${messageDate.getFullYear()}/${String(messageDate.getMonth() + 1).padStart(2, '0')}/${String(messageDate.getDate()).padStart(2, '0')}`; messages.appendChild(dateStamp); lastMessageDate = messageDateString; }
        const username = data.username || '名無しさん';
        const li = document.createElement('li');
        li.id = `message-${data.id}`;
        const bubble = document.createElement('div');
        const time = document.createElement('span');
        if (data.isImage === true) { const img = document.createElement('img'); img.src = data.text; img.addEventListener('click', () => showImageModal(data)); bubble.appendChild(img); } else { bubble.textContent = data.text; if (username === currentUsername) { bubble.addEventListener('contextmenu', (e) => { e.preventDefault(); showPopupMenu(bubble, data); }); } }
        time.textContent = `${String(messageDate.getHours()).padStart(2, '0')}:${String(messageDate.getMinutes()).padStart(2, '0')}`;
        bubble.className = 'bubble';
        time.className = 'message-time';
        if (username === currentUsername) { li.classList.add('me'); li.appendChild(time); li.appendChild(bubble); } else { const nameLabel = document.createElement('div'); nameLabel.textContent = username; nameLabel.className = 'name-label'; messages.appendChild(nameLabel); li.classList.add('opponent'); li.appendChild(bubble); li.appendChild(time); }
        messages.appendChild(li);
    };

    // --- 6. 各種メニューを表示するためのヘルパー関数群 ---
    function showPopupMenu(targetBubble, messageData) { const existingMenu = document.querySelector('.popup-menu'); if (existingMenu) existingMenu.remove(); const menu = document.createElement('div'); menu.className = 'popup-menu'; const copyButton = document.createElement('button'); copyButton.className = 'popup-menu-button'; copyButton.textContent = 'コピー'; copyButton.onclick = () => { navigator.clipboard.writeText(messageData.text); menu.remove(); }; const deleteButton = document.createElement('button'); deleteButton.className = 'popup-menu-button'; deleteButton.textContent = '削除'; deleteButton.onclick = () => { Swal.fire({ title: 'このメッセージを削除しますか？', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'はい、削除します', cancelButtonText: 'やめる' }).then((result) => { if (result.isConfirmed) { socket.emit('delete message', messageData.id); } }); menu.remove(); }; menu.appendChild(copyButton); menu.appendChild(deleteButton); document.body.appendChild(menu); const targetRect = targetBubble.getBoundingClientRect(); menu.style.top = `${window.scrollY + targetRect.top - menu.offsetHeight - 10}px`; menu.style.left = `${window.scrollX + targetRect.left + (targetRect.width / 2) - (menu.offsetWidth / 2)}px`; setTimeout(() => menu.classList.add('is-active'), 10); const closeMenu = (e) => { if (!menu.contains(e.target)) { menu.classList.remove('is-active'); setTimeout(() => menu.remove(), 100); window.removeEventListener('click', closeMenu, true); } }; setTimeout(() => window.addEventListener('click', closeMenu, true), 10); const closeMenuOnScroll = () => { menu.classList.remove('is-active'); setTimeout(() => menu.remove(), 100); messages.removeEventListener('scroll', closeMenuOnScroll); }; messages.addEventListener('scroll', closeMenuOnScroll); }
    function showImageModal(messageData) { Swal.fire({ html: `<div class="swal-custom-header"><button type="button" class="swal-delete-button" title="削除"><i class="fas fa-trash-alt"></i></button><a href="/download-image?url=${encodeURIComponent(messageData.text)}" class="swal-download-button" title="ダウンロード"><i class="fas fa-download"></i><span>Download</span></a><button type="button" class="swal2-close swal-close-button" title="閉じる">×</button></div>`, imageUrl: messageData.text, imageAlt: '拡大画像', padding: 0, background: 'transparent', backdrop: `rgba(0,0,0,0.8)`, showConfirmButton: false, customClass: { popup: 'fullscreen-swal', htmlContainer: 'swal-html-container-custom' }, didOpen: (modal) => { modal.querySelector('.swal-close-button').addEventListener('click', () => Swal.close()); const deleteButton = modal.querySelector('.swal-delete-button'); if (deleteButton) { deleteButton.addEventListener('click', () => { Swal.fire({ title: 'この画像を削除しますか？', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'はい、削除します', cancelButtonText: 'やめる' }).then((result) => { if (result.isConfirmed) { socket.emit('delete message', messageData.id); Swal.close(); } }); }); } } }); }
    
    // ---  音声録音モーダルを表示し、録音を開始する関数 ---
    let mediaRecorder;
    let audioChunks = [];

    function startRecording() {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.start();

                mediaRecorder.addEventListener("dataavailable", event => {
                    audioChunks.push(event.data);
                });

                Swal.fire({
                    title: '録音中...',
                    html: `
                        <div class="voice-recorder-timer">00:00</div>
                        <i class="fas fa-microphone-alt voice-recorder-icon is-recording"></i>
                    `,
                    showDenyButton: true,
                    showConfirmButton: true,
                    confirmButtonText: '<i class="fas fa-paper-plane"></i> 送信',
                    denyButtonText: '<i class="fas fa-stop-circle"></i> 停止',
                    customClass: {
                        popup: 'voice-recorder-popup',
                        actions: 'voice-recorder-actions'
                    }
                }).then((result) => {
                    if (result.isConfirmed || result.isDenied) {
                        stopRecordingAndUpload();
                    }
                    // ストリームを停止してマイクを解放
                    stream.getTracks().forEach(track => track.stop());
                });

            }).catch(error => {
                console.error("マイクへのアクセスに失敗しました:", error);
                Swal.fire('エラー', 'マイクへのアクセスが許可されていません。', 'error');
            });
    }

    // --- 5-4. 録音を停止し、音声ファイルをアップロードする関数 ---
    function stopRecordingAndUpload() {
        mediaRecorder.stop();

        mediaRecorder.addEventListener("stop", () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            // audioChunksをリセットして、次回の録音に備える
            audioChunks = [];

            // 画像と同じように、uploadImage関数を再利用してアップロード
            // ファイル名を指定するために、第三引数を追加
            uploadImage(audioBlob, true, 'voice-message.webm'); 
        });
    }

    // --- 7. 画像プレビューを表示するためのヘルパー関数 ---
    function showImagePreview(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            Swal.fire({
                background: '#2c2c2e', imageUrl: event.target.result, imageAlt: '画像プレビュー',
                showCancelButton: true, showConfirmButton: true,
                confirmButtonText: '<i class="fas fa-paper-plane"></i> SEND',
                cancelButtonText: '<i class="fas fa-times"></i> CLOSE',
                customClass: { popup: 'image-preview-popup', image: 'image-preview-image', actions: 'image-preview-actions', confirmButton: 'image-preview-button', cancelButton: 'image-preview-button' }
            }).then((result) => {
                if (result.isConfirmed) {
                    uploadImage(file);
                }
                imageInput.value = '';
            });
        };
        reader.readAsDataURL(file);
    }

    // --- 8. メッセージや画像の送信イベント ---
    form.addEventListener('submit', (e) => { e.preventDefault(); if (input.value) { socket.emit('chat message', { message: input.value, username: currentUsername, isImage: false }); input.value = ''; adjustTextareaHeight(); } });
    
    // --- 9. 添付メニューの制御 ---
    const closeAttachmentMenu = () => attachmentMenu.classList.remove('is-active');
    attachmentButton.addEventListener('click', () => attachmentMenu.classList.add('is-active'));
    closeMenuButton.addEventListener('click', closeAttachmentMenu);
    attachmentMenu.addEventListener('click', (e) => { if (e.target === attachmentMenu) closeAttachmentMenu(); });
    takePhotoButton.addEventListener('click', () => { imageInput.setAttribute('capture', 'environment'); imageInput.click(); closeAttachmentMenu(); });
    chooseFileButton.addEventListener('click', () => { imageInput.removeAttribute('capture'); imageInput.click(); closeAttachmentMenu(); });
    voiceButton.addEventListener('click', () => {
        closeAttachmentMenu();
        startRecording(); // 新しい録音開始関数を呼び出す
    });

    // 9-1. ファイルが選択された後の処理
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) { showImagePreview(file); }
    });
    // 9-2. 【カメラ対策】
    let fileInputClicked = false;
    attachmentButton.addEventListener('click', () => { fileInputClicked = true; });
    window.addEventListener('focus', () => { if (fileInputClicked) { setTimeout(() => { if (imageInput.files.length > 0) { const file = imageInput.files[0]; showImagePreview(file); } fileInputClicked = false; }, 500); } });

    async function uploadImage(file, isVoice = false, fileName = 'image.png') {
        const formData = new FormData();
        formData.append('file', file, fileName);  
        input.disabled = true; input.placeholder = '画像をアップロード中...'; 
        try {
            const response = await fetch('/upload-file', { method: 'POST', body: formData });
            if (!response.ok) { throw new Error('サーバーエラー'); }
            const result = await response.json();
            
            socket.emit('chat message', {
                message: result.secure_url,
                username: currentUsername,
                isImage: !isVoice, // 音声でないなら画像
                isVoice: isVoice  // 音声ならtrue
            });
        }
        catch (error) { console.error('画像アップロードに失敗しました:', error); alert('画像アップロードに失敗しました。'); } finally { input.disabled = false; input.placeholder = 'メッセージを入力'; adjustTextareaHeight(); } }

    // --- 10. テキストエリアの高さ自動調整機能 ---
    const adjustTextareaHeight = () => { const maxHeight = 120; input.style.height = 'auto'; const scrollHeight = input.scrollHeight; if (scrollHeight > maxHeight) { input.style.height = maxHeight + 'px'; input.style.overflowY = 'auto'; } else { input.style.height = scrollHeight + 'px'; input.style.overflowY = 'hidden'; } };
    input.addEventListener('input', adjustTextareaHeight);

    // --- 11. Socket.IOのイベントリスナー群 ---
    socket.on('connect', async () => { try { const response = await fetch('/get-theme'); const result = await response.json(); if (result.success && result.theme) { const chatThemeElement = document.querySelector('.chat-theme'); if (chatThemeElement) { chatThemeElement.textContent = result.theme; } } } catch (e) { console.error("テーマの読み込みに失敗しました:", e); } });
    socket.on('load old messages', (serverMessages) => { messages.innerHTML = ''; lastMessageDate = null; serverMessages.forEach(msg => displayMessage(msg)); messages.scrollTop = messages.scrollHeight; });
    socket.on('chat message', (data) => { displayMessage(data); messages.scrollTop = messages.scrollHeight; });
    socket.on('message deleted', (messageId) => { const messageElement = document.getElementById(`message-${messageId}`); if (messageElement) { const nameLabel = messageElement.previousElementSibling; if (nameLabel && nameLabel.classList.contains('name-label')) { nameLabel.remove(); } messageElement.remove(); } });
    socket.on('theme updated', (newTheme) => { const chatThemeElement = document.querySelector('.chat-theme'); if (chatThemeElement) { chatThemeElement.textContent = newTheme; } });
    
    // --- 12. ヘッダーのテーマ変更機能 ---
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

    // --- 13. 【シンプル版】キーボード表示時にスクロールする ---
    input.addEventListener('focus', () => { setTimeout(() => { form.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 150); });
}

// --- 14. 日付スタンプのフェードアウト処理 ---
const messagesContainer = document.getElementById('messages');
if (messagesContainer) {
    messagesContainer.addEventListener('scroll', () => {
        const dateStamps = messagesContainer.querySelectorAll('.date-stamp');
        if (dateStamps.length < 2) return;
        for (let i = 0; i < dateStamps.length - 1; i++) {
            const currentStamp = dateStamps[i];
            const nextStamp = dateStamps[i + 1];
            const currentRect = currentStamp.getBoundingClientRect();
            const nextRect = nextStamp.getBoundingClientRect();
            if (nextRect.top <= currentRect.top + 5) {
                currentStamp.classList.add('is-hiding');
            } else {
                currentStamp.classList.remove('is-hiding');
            }
        }
    });
}