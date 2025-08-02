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
        if (data.isVoice === true) { const audioPlayer = document.createElement('audio'); audioPlayer.src = data.text; audioPlayer.controls = true; bubble.appendChild(audioPlayer); 
             if (username === currentUsername) {
                // 自分の音声メッセージの場合だけ、長押し(contextmenu)イベントを設定
                bubble.addEventListener('contextmenu', (e) => {
                    e.preventDefault(); // デフォルトの右クリックメニューをキャンセル
                    
                    // 第3引数に「true」（音声だよ）を渡して、ポップアップメニューを呼び出す
                    showPopupMenu(bubble, data, true); 
                });
            }
        } else if (data.isImage === true) { const img = document.createElement('img'); img.src = data.text; img.addEventListener('click', () => showImageModal(data)); bubble.appendChild(img); }
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
    function showPopupMenu(targetBubble, messageData, isVoice = false) {
        const existingMenu = document.querySelector('.popup-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'popup-menu';
        
        if (!isVoice) {
            const copyButton = document.createElement('button');
            copyButton.className = 'popup-menu-button';
            copyButton.innerHTML = `<i class="fas fa-copy"></i> コピー`;
            copyButton.onclick = () => { navigator.clipboard.writeText(messageData.text); menu.remove(); };
            menu.appendChild(copyButton);
        }

        const deleteButton = document.createElement('button');
        deleteButton.className = 'popup-menu-button';
        deleteButton.innerHTML = `<i class="fas fa-trash-alt"></i> 削除`;
        deleteButton.onclick = () => {
            Swal.fire({
                title: `この${isVoice ? '音声' : 'メッセージ'}を削除しますか？`,
                showCancelButton: true,
                confirmButtonText: '削除',
                cancelButtonText: 'やめる',
                background: '#333',
                customClass: {
                    popup: 'delete-confirm-popup',
                    title: 'delete-confirm-title',
                    htmlContainer: 'delete-confirm-text',
                    confirmButton: 'delete-confirm-button confirm',
                    cancelButton: 'delete-confirm-button cancel'
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    socket.emit('delete message', messageData.id);
                }
            });
            menu.remove();
        };

        menu.appendChild(deleteButton);
        
        // --- ↓↓↓ ここからが、新しい、確実な位置計算ロジック ↓↓↓ ---
        
        // 1. まず、メニューを目に見えない状態でページに追加する
        menu.style.visibility = 'hidden';
        document.body.appendChild(menu);
        
        // 3. メッセージ吹き出しの座標を取得
        const bubbleRect = targetBubble.getBoundingClientRect();
        
        // メニューを、吹き出しの上端から、少しだけ上に表示
        menu.style.top = `${window.scrollY + bubbleRect.top - menu.offsetHeight - 10}px`;
        // メニューを、吹き出しの水平方向の中央に配置


        // --- ↑↑↑ 位置計算ロジックここまで ---

        setTimeout(() => menu.classList.add('is-active'), 10);

        const closeMenu = (e) => {
            if (e.type === 'scroll' || !menu.contains(e.target)) {
                menu.remove();
                window.removeEventListener('click', closeMenu, true);
                messages.removeEventListener('scroll', closeMenu);
            }
        };
        setTimeout(() => {
            window.addEventListener('click', closeMenu, true);
            messages.addEventListener('scroll', closeMenu);
        }, 10);
    }

    

    // --- 6. 各種メニューを表示するためのヘルパー関数群 ---
    function showPopupMenu(targetBubble, messageData, isVoice = false) {
        const existingMenu = document.querySelector('.popup-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'popup-menu';
        
        if (!isVoice) {
            const copyButton = document.createElement('button');
            copyButton.className = 'popup-menu-button';
            copyButton.innerHTML = `<i class="fas fa-copy"></i> コピー`; // アイコン追加
            copyButton.onclick = () => { navigator.clipboard.writeText(messageData.text); menu.remove(); };
            menu.appendChild(copyButton);
        }

        const deleteButton = document.createElement('button');
        deleteButton.className = 'popup-menu-button';
        // ↓↓↓ ゴミ箱アイコンを追加！ ↓↓↓
        deleteButton.innerHTML = `<i class="fas fa-trash-alt"></i> 削除`; 
        deleteButton.onclick = () => {
            Swal.fire({
                title: `この${isVoice ? '音声' : 'メッセージ'}を削除しますか？`,
                showCancelButton: true,
                confirmButtonText: '削除',
                cancelButtonText: 'やめる',
                background: '#333',
                customClass: {
                    popup: 'delete-confirm-popup',
                    title: 'delete-confirm-title',
                    htmlContainer: 'delete-confirm-text',
                    confirmButton: 'delete-confirm-button confirm',
                    cancelButton: 'delete-confirm-button cancel'
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    socket.emit('delete message', messageData.id);
                }
            });
            menu.remove();
        };

        menu.appendChild(deleteButton);
        document.body.appendChild(menu);

        const targetRect = targetBubble.getBoundingClientRect();
        menu.style.top = `${window.scrollY + targetRect.top - menu.offsetHeight - 10}px`;
        menu.style.left = `${window.scrollX + targetRect.left - menu.offsetWidth - 10}px`;

        setTimeout(() => menu.classList.add('is-active'), 10);

        // --- ↓↓↓ ここからが、スクロールで消す機能 ↓↓↓ ---
        const closeMenu = (e) => {
            // メニューの外側をクリックしたか、スクロールが発生したかをチェック
            if (e.type === 'scroll' || !menu.contains(e.target)) {
                menu.remove();
                // イベントリスナーを、必ず両方とも解除する
                window.removeEventListener('click', closeMenu, true);
                messages.removeEventListener('scroll', closeMenu);
            }
        };
        setTimeout(() => {
            window.addEventListener('click', closeMenu, true);
            messages.addEventListener('scroll', closeMenu);
        }, 10);
        // --- ↑↑↑ ここまでが、スクロールで消す機能 ---
    }
    function showImagePreview(file) { const reader = new FileReader(); reader.onload = (event) => { Swal.fire({ background: '#2c2c2e', imageUrl: event.target.result, imageAlt: '画像プレビュー', showCancelButton: true, showConfirmButton: true, confirmButtonText: '<i class="fas fa-paper-plane"></i> SEND', cancelButtonText: '<i class="fas fa-times"></i> CLOSE', customClass: { popup: 'image-preview-popup', image: 'image-preview-image', actions: 'image-preview-actions', confirmButton: 'image-preview-button', cancelButton: 'image-preview-button' } }).then((result) => { if (result.isConfirmed) { uploadImage(file); } imageInput.value = ''; }); }; reader.readAsDataURL(file); }
    /**
 * 画像をクリックした時に、全画面のモーダルウィンドウで表示する関数
 * @param {object} messageData - クリックされた画像のメッセージデータ
 */
function showImageModal(messageData) {
    Swal.fire({
        // 全画面表示用のカスタムクラスを適用
        customClass: {
            popup: 'fullscreen-swal',
            htmlContainer: 'swal-html-container-custom' // ヘッダー用のコンテナクラス
        },
        // 背景をクリックしても閉じないようにする
        allowOutsideClick: true, 
        showConfirmButton: false, // 標準のボタンは非表示
        showCloseButton: false,   // 標準の閉じるボタンも非表示

        // メインに画像を表示
        imageUrl: messageData.text,
        imageAlt: '拡大画像',

        // ★★★ ここからが重要！右上のカスタムヘッダーを作る ★★★
        html: `
            <div class="swal-custom-header">
                <a href="/download-image?url=${encodeURIComponent(messageData.text)}" download class="swal-header-button">
                    <i class="fas fa-download"></i>
                </a>
                <button id="swal-close-button" class="swal-header-button">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `,
        // HTMLが挿入された直後に、閉じるボタンにイベントを設定
        didOpen: (modal) => {
            modal.querySelector('#swal-close-button')?.addEventListener('click', () => {
                Swal.close();
            });
            // 背景クリックで閉じるようにする
            const backdrop = modal.querySelector('.swal2-backdrop');
            if(backdrop) {
                backdrop.addEventListener('click', () => {
                     Swal.close();
                });
            }
        }
    });
}
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
    socket.on('load old messages', (serverMessages) => {
    messages.innerHTML = '';
    lastMessageDate = null;
    
    // 単純に、受け取ったメッセージを全部表示するだけの処理にする
    serverMessages.forEach(msg => {
        displayMessage(msg);
    });

    // 読み込み終わったら、一番下までスクロール（これは残しておく）
    messages.scrollTop = messages.scrollHeight;
});
    
    // --- 9. ヘッダーのテーマ変更機能 ---
    if (chatThemeElement) {
            chatThemeElement.addEventListener('click', () => {
                Swal.fire({
                    // ↓↓↓ ここからが修正・追加箇所 ↓↓↓

                    title: 'お好きなテーマを入力', // ★ タイトルを変更
                    input: 'text',
                    inputValue: chatThemeElement.textContent,
                    showCancelButton: true,
                    confirmButtonText: '変更する',
                    cancelButtonText: 'やめる',

                    // ★ 新しく定義したカスタムクラスを、ここで適用！ ★
                    customClass: {
                        popup: 'theme-edit-popup',
                        title: 'theme-edit-title',
                        input: 'theme-edit-input',
                        confirmButton: 'theme-edit-button confirm',
                        cancelButton: 'theme-edit-button cancel'
                    },

                    // ↑↑↑ ここまでが修正・追加箇所 ↑↑↑

                    inputAttributes: { maxlength: 10 },
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

// --- 11. 日付スタンプの重なり検出とフェードアウト処理 ---
const messagesContainer = document.getElementById('messages');

if (messagesContainer) {
    // 【偵察兵1】そもそも、このイベントリスナーは動いているか？
    console.log('[デバッグ] 日付スタンプのスクロール監視を開始します。');

    messagesContainer.addEventListener('scroll', () => {
        const dateStamps = messagesContainer.querySelectorAll('.date-stamp');
        if (dateStamps.length < 2) return;

        for (let i = 0; i < dateStamps.length - 1; i++) {
            const currentStamp = dateStamps[i];
            const nextStamp = dateStamps[i + 1];

            const currentRect = currentStamp.getBoundingClientRect();
            const nextRect = nextStamp.getBoundingClientRect();

            // 【偵察兵2】座標は正しく取れているか？
            // コンソールに current と next の top 座標が連続で表示されるはず
            if (i === 0) { // ログが大量に出過ぎないように、最初のスタンプだけ監視
                 console.log(`[デバッグ] current.top: ${currentRect.top.toFixed(0)}, next.top: ${nextRect.top.toFixed(0)}`);
            }

            // 【偵察兵3】if文の条件は true になっているか？
            if (nextRect.top <= currentRect.top + 5) {
                // 条件が満たされたら、ログを出す
                console.log(`[デバッグ] ★★★ 重なり検出！ ${currentStamp.textContent} を隠します ★★★`);
                currentStamp.style.opacity = '0';
            } else {
                currentStamp.style.opacity = '1';
            }
        }
    });
}

/////////// --- 15. 動く背景アニメーション ---
const canvas = document.getElementById('background-canvas');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let circles = [];
    
    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const createCircle = () => {
        const colors = [
            'rgba(65, 160, 205, 0.75)',
            'rgba(186, 68, 86, 0.8)',
            'rgba(199, 214, 58, 0.77)'
        ];
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: 40 + Math.random() * 100,
            speed: 0.1 + Math.random() * 0.3, // ★★★ 動きを、もっとゆっくりに ★★★
            color: colors[Math.floor(Math.random() * colors.length)]
        };
    };
///////////////--------カラーボールの数--------////////////////////
    for (let i = 0; i < 12; i++) {
        circles.push(createCircle());
    }

    const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        circles.forEach(circle => {
            circle.y += circle.speed;
            if (circle.y > canvas.height + circle.radius) {
                circle.y = -circle.radius;
                circle.x = Math.random() * canvas.width;
            }
            ctx.beginPath();
            ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
            ctx.fillStyle = circle.color;
            ctx.fill();
        });
        requestAnimationFrame(animate);
    };
    animate();
}




// --- 16. CSSアニメーションによるオープニング演出 ---
document.addEventListener('DOMContentLoaded', () => {
    // ページが読み込まれたら、すぐにアニメーション開始のクラスを付与する
    document.querySelector('.chat-container')?.classList.add('is-animating');
});

