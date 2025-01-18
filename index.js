
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

// Status apakah admin (bot) sedang online atau offline
let adminOnline = false;

async function startBot() {
    // Menggunakan MultiFileAuthState untuk menyimpan sesi
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    // Membuat koneksi dengan Baileys
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Menampilkan QR di terminal
    });

    // Mendapatkan ID bot (nomor bot itu sendiri)
    const botNumber = sock.user.id;  // Nomor bot yang sedang digunakan

    // Event handler ketika ada pesan masuk
    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];

        // Abaikan pesan jika bukan dari pengguna atau berasal dari grup
        if (!message.message || message.key.fromMe || message.key.remoteJid.includes('@g.us')) return;

        const sender = message.key.remoteJid; // Pengirim pesan

        if (!adminOnline) {
            // Balas pesan otomatis jika admin (bot) offline
            const replyMessage = "wett , admin lagi opp";
            await sock.sendMessage(sender, { text: replyMessage });
        }
    });

    // Event handler untuk koneksi update
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error = Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus. Rekoneksi:', shouldReconnect);

            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Koneksi berhasil!');
        }
    });

    // Menyimpan kredensial saat ada perubahan
    sock.ev.on('creds.update', saveCreds);

    // Fungsi untuk mengubah status admin (bot) secara manual
    process.stdin.on('data', (data) => {
        const input = data.toString().trim();

        // Hanya bot yang bisa mengubah statusnya sendiri
        if (input.toLowerCase() === 'online' && sock.user.id === botNumber) {
            adminOnline = true;
            console.log('Bot sekarang online. Tidak akan membalas pesan.');
        } else if (input.toLowerCase() === 'offline' && sock.user.id === botNumber) {
            adminOnline = false;
            console.log('Bot sekarang offline. Bot akan membalas pesan.');
        } else {
            console.log("Input tidak dikenali atau kamu tidak memiliki izin. Gunakan 'online' atau 'offline'.");
        }
    });

    // Event handler untuk memastikan hanya bot yang bisa mengubah status secara manual
    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];

        // Abaikan jika pesan berasal dari bot sendiri (fromMe) atau grup
        if (message.key.fromMe) {
            const input = message.message.conversation?.toLowerCase().trim();
            
            // Jika perintah 'online' atau 'offline' datang dari bot, ubah status
            if (input === 'on') {
                adminOnline = true;
                console.log('Bot sekarang online. Tidak akan membalas pesan.');
            } else if (input === 'off') {
                adminOnline = false;
                console.log('Bot sekarang offline. Bot akan membalas pesan.');
            }
        }
    });
}

startBot().catch((err) => console.error('Error saat menjalankan bot:', err));
