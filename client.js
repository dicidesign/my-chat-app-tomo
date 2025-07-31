// 【client.js 省略なし・削除機能リセット版】

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
const chatThemeElement = document.querySelector('.chat-theme');

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
        if (!data || typeof data.text !== 'string' || !data.createdAt || !data.id) { return; }
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
        if (data.isVoice === true) { const audioPlayer = document.createElement('audio'); audioPlayer.src = data.text; audioPlayer.controls = true; bubble.appendChild(audioPlayer); }
        else if (data.isImage === true) { const img = document.createElement('img'); img.src = data.text; img.addEventListener('click', () => showImageModal(data)); bubble.appendChild(img); }
        else {
            // --- テキストメッセージの場合 ---
            bubble.textContent = data.text;
            if (username === currentUsername) {
                // 自分のテキストメッセージにだけ、長押し(contextmenu)イベントを設定
                bubble.addEventListener('contextmenu', (e) => {
                    e.preventDefault(); // デフォルトの右クリックメニューをキャンセル
                    showPopupMenu(bubble, data);
                });
            }
        }
        time.textContent = `${String(messageDate.getHours()).padStart(2, '0')}:${String(messageDate.getMinutes()).padStart(2, '0')}`;
        bubble.className = 'bubble';
        time.className = 'message-time';
        if (username === currentUsername) { li.classList.add('me'); li.appendChild(time); li.appendChild(bubble); } else { const nameLabel = document.createElement('div'); nameLabel.textContent = username; nameLabel.className = 'name-label'; messages.appendChild(nameLabel); li.classList.add('opponent'); li.appendChild(bubble); li.appendChild(time); }
        messages.appendChild(li);
    };
    // --- メッセージ削除用のポップアップメニュー ---
    function showPopupMenu(targetBubble, messageData) {
        // もし既に他のメニューが開いていたら、それを消す
        const existingMenu = document.querySelector('.popup-menu');
        if (existingMenu) existingMenu.remove();

        // 1. メニューのHTML要素をゼロから作成
        const menu = document.createElement('div');
        menu.className = 'popup-menu';
        
        // 2. 「コピー」ボタンを作成し、機能を設定
        const copyButton = document.createElement('button');
        copyButton.className = 'popup-menu-button';
        copyButton.textContent = 'コピー';
        copyButton.onclick = () => {
            navigator.clipboard.writeText(messageData.text);
            menu.remove(); // 押したらメニューを消す
        };

        // 3. 「削除」ボタンを作成し、機能を設定
        const deleteButton = document.createElement('button');
        deleteButton.className = 'popup-menu-button';
        deleteButton.textContent = '削除';
        deleteButton.onclick = () => {
            Swal.fire({
                // --- ↓↓↓ ここからが新しいデザイン設定 ↓↓↓ ---
                title: 'このメッセージを削除しますか？',
                icon: 'warning',
                iconColor: '#f8bb86',
                
                showCancelButton: true,
                confirmButtonText: '削除',
                cancelButtonText: 'やめる',

                background: '#333', // 背景をダークグレーに
                customClass: {
                    popup: 'delete-confirm-popup',
                    title: 'delete-confirm-title',
                    htmlContainer: 'delete-confirm-text',
                    confirmButton: 'delete-confirm-button confirm',
                    cancelButton: 'delete-confirm-button cancel'
                }
                // --- ↑↑↑ ここまでが新しいデザイン設定 ---
            }).then((result) => {
                if (result.isConfirmed) {
                    socket.emit('delete message', messageData.id);
                }
            });
            menu.remove(); // 押したらメニューを消す
        };

        // 4. 作成したボタンをメニューに追加
        menu.appendChild(copyButton);
        menu.appendChild(deleteButton);

        // 5. ページにメニューを追加
        document.body.appendChild(menu);

        // 6. メニューの位置を、長押しされたメッセージの横に計算して設定
        const bubbleRect = targetBubble.getBoundingClientRect();
        menu.style.top = `${window.scrollY + bubbleRect.top + (bubbleRect.height / 2) - (menu.offsetHeight / 2)}px`;
        menu.style.left = `${window.scrollX + bubbleRect.left - menu.offsetWidth - 10}px`; // 吹き出しの左に10pxの隙間

        // 7. 表示アニメーションを開始
        setTimeout(() => menu.classList.add('is-active'), 10);

        // 8. メニューの外側をクリックしたら、メニューを消す
        const closeMenuOnClickOutside = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                window.removeEventListener('click', closeMenuOnClickOutside, true);
            }
        };
        setTimeout(() => window.addEventListener('click', closeMenuOnClickOutside, true), 10);
    }

    // --- 6. 各種メニューを表示するためのヘルパー関数群 ---
    function showImageModal(messageData) { Swal.fire({ html: `<div class="swal-custom-header"><a href="/download-image?url=${encodeURIComponent(messageData.text)}" class="swal-download-button" title="ダウンロード"><i class="fas fa-download"></i><span>Download</span></a><button type="button" class="swal2-close swal-close-button" title="閉じる">×</button></div>`, imageUrl: messageData.text, imageAlt: '拡大画像', padding: 0, background: 'transparent', backdrop: `rgba(0,0,0,0.8)`, showConfirmButton: false, customClass: { popup: 'fullscreen-swal', htmlContainer: 'swal-html-container-custom' }, didOpen: (modal) => { modal.querySelector('.swal-close-button').addEventListener('click', () => Swal.close()); } }); }
    function showImagePreview(file) { const reader = new FileReader(); reader.onload = (event) => { Swal.fire({ background: '#2c2c2e', imageUrl: event.target.result, imageAlt: '画像プレビュー', showCancelButton: true, showConfirmButton: true, confirmButtonText: '<i class="fas fa-paper-plane"></i> SEND', cancelButtonText: '<i class="fas fa-times"></i> CLOSE', customClass: { popup: 'image-preview-popup', image: 'image-preview-image', actions: 'image-preview-actions', confirmButton: 'image-preview-button', cancelButton: 'image-preview-button' } }).then((result) => { if (result.isConfirmed) { uploadImage(file); } imageInput.value = ''; }); }; reader.readAsDataURL(file); }
    let mediaRecorder; let audioChunks = []; let timerInterval;
    function handleVoiceButtonClick() { Swal.fire({ html: `<div class="voice-recorder-icon-wrapper"><img src="images/icon-voice.png" alt="音声録音" class="voice-recorder-icon"></div><div class="voice-recorder-timer">00:00</div>`, showConfirmButton: true, showDenyButton: true, showCancelButton: true, confirmButtonText: '<i class="fas fa-circle"></i> REC', denyButtonText: '<i class="fas fa-stop"></i> STOP', cancelButtonText: '<i class="fas fa-times"></i> CLOSE', customClass: { popup: 'voice-recorder-popup', confirmButton: 'rec-button', denyButton: 'stop-button', cancelButton: 'close-button' }, didOpen: (modal) => { const recBtn = modal.querySelector('.rec-button'); const stopBtn = modal.querySelector('.stop-button'); stopBtn.disabled = true; recBtn.addEventListener('click', () => { recBtn.classList.add('is-active'); stopBtn.classList.remove('is-active'); startAudioRecording(modal); }); stopBtn.addEventListener('click', () => { stopBtn.classList.add('is-active'); recBtn.classList.remove('is-active'); stopAudioRecording(); }); }, preConfirm: () => false, preDeny: () => false }).then(() => { if (mediaRecorder && mediaRecorder.state === "recording") { mediaRecorder.stream.getTracks().forEach(track => track.stop()); } clearInterval(timerInterval); closeAttachmentMenu(); }); }
    function startAudioRecording(modal) { navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => { mediaRecorder = new MediaRecorder(stream); mediaRecorder.start(); audioChunks = []; mediaRecorder.addEventListener("dataavailable", e => audioChunks.push(e.data)); modal.querySelector('.rec-button').disabled = true; modal.querySelector('.stop-button').disabled = false; modal.querySelector('.voice-recorder-icon').classList.add('is-recording'); let seconds = 0; const timerElement = modal.querySelector('.voice-recorder-timer'); timerInterval = setInterval(() => { seconds++; const min = Math.floor(seconds / 60).toString().padStart(2, '0'); const sec = (seconds % 60).toString().padStart(2, '0'); if(timerElement) timerElement.textContent = `${min}:${sec}`; }, 1000); }).catch(err => Swal.fire('エラー', 'マイクへのアクセスが許可されていません。', 'error')); }
    function stopAudioRecording() { if (!mediaRecorder || mediaRecorder.state !== 'recording') return; mediaRecorder.stop(); clearInterval(timerInterval); mediaRecorder.addEventListener("stop", () => { const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); const audioUrl = URL.createObjectURL(audioBlob); showAudioCheckModal(audioBlob, audioUrl); }, { once: true }); }
    function showAudioCheckModal(audioBlob, audioUrl) {
        const audio = new Audio(audioUrl);
        Swal.fire({
            // ★★★ htmlオプションで、全てのUIを自作する！ ★★★
            html: `
                <div class="audio-check-container">
                    <div class="audio-check-title">Audio check</div>
                    <div class="audio-check-buttons-main">
                        <button id="play-audio-btn" class="audio-check-button"><i class="fas fa-play"></i> PLAY</button>
                        <button id="stop-audio-btn" class="audio-check-button"><i class="fas fa-stop"></i> STOP</button>
                        <button id="send-audio-btn" class="audio-check-button send"><i class="fas fa-paper-plane"></i></button>
                    </div>
                    <div class="audio-check-buttons-footer">
                        <button id="close-audio-check-btn" class="audio-check-button close"><i class="fas fa-times"></i> CLOSE</button>
                    </div>
                </div>
            `,
            showConfirmButton: false, // 標準のボタンは一切使わない
            showDenyButton: false,
            showCancelButton: false,
            background: '#333',
            customClass: {
                popup: 'voice-recorder-popup audio-check-popup',
            },
            
            didOpen: (modal) => {
                const playBtn = modal.querySelector('#play-audio-btn');
                const stopBtn = modal.querySelector('#stop-audio-btn');
                const sendBtn = modal.querySelector('#send-audio-btn');
                const closeBtn = modal.querySelector('#close-audio-check-btn');

                playBtn.onclick = () => { audio.currentTime = 0; audio.play(); };
                stopBtn.onclick = () => { audio.pause(); };
                sendBtn.onclick = () => { uploadImage(audioBlob, true, 'voice-message.webm'); Swal.close(); };
                closeBtn.onclick = () => Swal.close();

                audio.onplay = () => { playBtn.classList.add('is-active'); stopBtn.classList.remove('is-active'); };
                audio.onpause = () => { playBtn.classList.remove('is-active'); };
                audio.onended = () => { playBtn.classList.remove('is-active'); stopBtn.classList.remove('is-active'); };
            },
        }).then((result) => {
            audio.pause();
            audio.src = '';
            closeAttachmentMenu();
        });
    }

    // --- 7. イベントリスナーとアップロード処理 ---
    form.addEventListener('submit', (e) => { e.preventDefault(); if (input.value) { socket.emit('chat message', { message: input.value, username: currentUsername, isImage: false }); input.value = ''; adjustTextareaHeight(); } });
    const closeAttachmentMenu = () => attachmentMenu.classList.remove('is-active');
    attachmentButton.addEventListener('click', () => attachmentMenu.classList.add('is-active'));
    closeMenuButton.addEventListener('click', closeAttachmentMenu);
    attachmentMenu.addEventListener('click', (e) => { if (e.target === attachmentMenu) closeAttachmentMenu(); });
    takePhotoButton.addEventListener('click', () => { imageInput.setAttribute('capture', 'environment'); imageInput.click(); closeAttachmentMenu(); });
    chooseFileButton.addEventListener('click', () => { imageInput.removeAttribute('capture'); imageInput.click(); closeAttachmentMenu(); });
    voiceButton.addEventListener('click', handleVoiceButtonClick);
    imageInput.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) { showImagePreview(file); } });
    let fileInputClicked = false;
    attachmentButton.addEventListener('click', () => { fileInputClicked = true; });
    window.addEventListener('focus', () => { if (fileInputClicked) { setTimeout(() => { if (imageInput.files.length > 0) { const file = imageInput.files[0]; showImagePreview(file); } fileInputClicked = false; }, 500); } });
    async function uploadImage(file, isVoice = false, fileName = 'image.png') { const formData = new FormData(); formData.append('file', file, fileName); input.disabled = true; input.placeholder = 'ファイルをアップロード中...'; try { const response = await fetch('/upload-file', { method: 'POST', body: formData }); if (!response.ok) { throw new Error('サーバーエラー'); } const result = await response.json(); socket.emit('chat message', { message: result.secure_url, username: currentUsername, isImage: !isVoice, isVoice: isVoice }); } catch (error) { console.error('ファイルアップロードに失敗しました:', error); alert('アップロードに失敗しました。'); } finally { input.disabled = false; input.placeholder = 'メッセージを入力'; adjustTextareaHeight(); } }
    const adjustTextareaHeight = () => { const maxHeight = 120; input.style.height = 'auto'; const scrollHeight = input.scrollHeight; if (scrollHeight > maxHeight) { input.style.height = maxHeight + 'px'; input.style.overflowY = 'auto'; } else { input.style.height = scrollHeight + 'px'; input.style.overflowY = 'hidden'; } };
    input.addEventListener('input', adjustTextareaHeight);
    
    // --- 8. Socket.IOのイベントリスナー群 ---
    socket.on('connect', async () => { try { const response = await fetch('/get-theme'); const result = await response.json(); if (result.success && result.theme) { if (chatThemeElement) { chatThemeElement.textContent = result.theme; } } } catch (e) { console.error("テーマの読み込みに失敗しました:", e); } });
    socket.on('load old messages', (serverMessages) => { messages.innerHTML = ''; lastMessageDate = null; serverMessages.forEach(msg => displayMessage(msg)); messages.scrollTop = messages.scrollHeight; });
    socket.on('chat message', (data) => { displayMessage(data); messages.scrollTop = messages.scrollHeight; });
    socket.on('theme updated', (newTheme) => { if (chatThemeElement) { chatThemeElement.textContent = newTheme; } });
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
    
    // --- 9. ヘッダーのテーマ変更機能 ---
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

    // --- 10. 【シンプル版】キーボード表示時にスクロールする ---
    input.addEventListener('focus', () => { setTimeout(() => { form.scrollIntoView(false); }, 300); });
}

// --- 11. 日付スタンプのフェードアウト処理 ---
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
            if (nextRect.top <= currentRect.top + 5) { currentStamp.classList.add('is-hiding'); } else { currentStamp.classList.remove('is-hiding'); }
        }
    });
}