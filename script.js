import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC-y0KtCLH0g65Q7nCb31avCx5G3iKekLc",
    authDomain: "purple-tickets.firebaseapp.com",
    projectId: "purple-tickets",
    storageBucket: "purple-tickets.firebasestorage.app",
    messagingSenderId: "808397510409",
    appId: "1:808397510409:web:cee298484e7f6db48da5d8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let meetupSelecionadoId = null;

// --- NAVEGAÇÃO DE ABAS DO SITE ---
window.mudarAba = function(aba) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('ativa'));
    document.querySelectorAll('.btn-aba').forEach(el => el.classList.remove('active'));

    if (aba === 'meetups') {
        const elAba = document.getElementById('aba-meetups');
        const elBtn = document.getElementById('btn-meetups');
        if (elAba) elAba.classList.add('ativa');
        if (elBtn) elBtn.classList.add('active');
    } else if (aba === 'status') {
        const elAba = document.getElementById('aba-status');
        const elBtn = document.getElementById('btn-status');
        if (elAba) elAba.classList.add('ativa');
        if (elBtn) elBtn.classList.add('active');
    } else if (aba === 'episodios') {
        const elAba = document.getElementById('aba-episodios');
        const elBtn = document.getElementById('btn-episodios');
        if (elAba) elAba.classList.add('ativa');
        if (elBtn) elBtn.classList.add('active');
    }
};

// --- CARREGAR MEETUPS E STATUS ---
async function carregarMeetups() {
    const containerMeetups = document.getElementById('lista-meetups');
    const containerStatus = document.getElementById('lista-status');
    
    try {
        const snap = await getDocs(collection(db, "meetups"));
        if (containerMeetups) containerMeetups.innerHTML = "";
        if (containerStatus) containerStatus.innerHTML = "";

        if (snap.empty) {
            if (containerMeetups) containerMeetups.innerHTML = "<p>Nenhum Meetup agendado no momento.</p>";
            if (containerStatus) containerStatus.innerHTML = "<p>Sem avisos no momento.</p>";
            return;
        }

        snap.forEach(docSnap => {
            const m = docSnap.data();
            
            if (containerMeetups) {
                containerMeetups.innerHTML += `
                    <div class="item-lista">
                        <div>
                            <strong>${m.nome}</strong><br>
                            <small style="color: #ccc;">📅 ${m.data || 'A definir'} às ${m.horario || '--:--'} | R$ ${m.preco || '0'}</small>
                        </div>
                        <button class="btn-comprar" onclick="window.abrirModalCompraMeetup('${docSnap.id}')">Garantir Ticket</button>
                    </div>
                `;
            }

            if (containerStatus) {
                containerStatus.innerHTML += `
                    <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 10px; margin-bottom: 10px; text-align: left;">
                        <strong>📍 ${m.nome}:</strong><br>
                        <span style="font-size: 14px;">${m.mensagemStatus || "Nenhuma atualização no momento."}</span>
                    </div>
                `;
            }
        });
    } catch (error) {
        console.error("Erro ao carregar Meetups:", error);
    }
}

// ==========================================
// NOVA SESSÃO: PRÉ-LANÇAMENTOS DE EPISÓDIOS
// ==========================================

window.abrirEpisodios = async function() {
    window.mudarAba('episodios');
    const container = document.getElementById('lista-episodios');
    if (!container) return;
    
    container.innerHTML = "<p style='color: white;'>Carregando episódios...</p>";

    try {
        const snap = await getDocs(collection(db, "episodios"));
        container.innerHTML = "";

        if (snap.empty) {
            container.innerHTML = "<p style='color: #d1b3ff;'>Nenhum episódio em pré-lançamento no momento.</p>";
            return;
        }

        snap.forEach(docSnap => {
            const ep = docSnap.data();
            
            container.innerHTML += `
                <div class="item-lista" style="flex-direction: column; text-align: center; gap: 15px;">
                    <img src="${ep.thumb}" alt="Thumbnail do Episódio" style="width: 100%; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
                    <div>
                        <strong style="font-size: 1.2rem;">${ep.nome}</strong>
                    </div>
                    <button class="btn-comprar" style="width: 100%;" onclick="window.tentarAssistir('${ep.youtubeLink}')">🎬 Assistir Pré-lançamento</button>
                </div>
            `;
        });
    } catch (error) {
        console.error("Erro ao carregar Episódios:", error);
        container.innerHTML = "<p style='color: #ff4444;'>Erro ao carregar a lista de episódios.</p>";
    }
};

window.tentarAssistir = async function(youtubeLink) {
    const emailDigitado = prompt("📧 Para acessar o modo Teatro, digite seu Gmail:");
    if (!emailDigitado) return;

    const senhaDigitada = prompt("🔒 Digite a senha VIP da Purple Studios:");
    if (!senhaDigitada) return;

    try {
        // Checa se o usuário está banido antes de qualquer coisa
        const banidosSnap = await getDocs(collection(db, "banidos"));
        let banido = false;
        banidosSnap.forEach(d => {
            if (d.data().email === emailDigitado.toLowerCase().trim()) banido = true;
        });

        if (banido) {
            return alert("🚫 Seu e-mail está banido e não tem permissão para assistir aos episódios.");
        }

        // Valida a senha VIP na coleção de segurança
        const configSnap = await getDocs(collection(db, "episodiosConfig"));
        let acessoLiberado = false;

        configSnap.forEach(d => {
            if (d.data().senha === senhaDigitada.trim()) {
                acessoLiberado = true;
            }
        });

        if (acessoLiberado) {
            alert("✅ Acesso Liberado! Aproveite o episódio sem anúncios!");
            window.open(youtubeLink, '_blank'); // Abre o YouTube em uma nova aba
        } else {
            alert("❌ Senha VIP incorreta. Acesso negado.");
        }

    } catch (err) {
        console.error("Erro ao validar acesso ao episódio:", err);
        alert("❌ Erro no servidor ao validar o acesso.");
    }
};

// ==========================================
// JANELA DE 4 ETAPAS (APENAS PARA TICKETS AGORA)
// ==========================================

window.abrirModalCompraMeetup = function(id) {
    meetupSelecionadoId = id;
    iniciarModal();
};

function iniciarModal() {
    const modal = document.getElementById('compraModal');
    if (modal) modal.style.display = 'flex';

    const et0 = document.getElementById('etapa0');
    const et1 = document.getElementById('etapa1');
    const et3 = document.getElementById('etapa3');
    const et4 = document.getElementById('etapa4');

    if (et0) et0.style.display = 'block';
    if (et1) et1.style.display = 'none';
    if (et3) et3.style.display = 'none';
    if (et4) et4.style.display = 'none';

    const c1 = document.getElementById('checkTermos');
    const c2 = document.getElementById('checkReembolso');
    const c3 = document.getElementById('checkRegras');
    if (c1) c1.checked = false;
    if (c2) c2.checked = false;
    if (c3) c3.checked = false;
}

window.irParaEtapa1 = function() {
    const cTermos = document.getElementById('checkTermos');
    const cReembolso = document.getElementById('checkReembolso');
    const cRegras = document.getElementById('checkRegras');

    if ((cTermos && !cTermos.checked) || (cReembolso && !cReembolso.checked) || (cRegras && !cRegras.checked)) {
        return alert("⚠️ Você precisa aceitar os Termos, o Reembolso e as Regras para continuar!");
    }

    const et0 = document.getElementById('etapa0');
    const et1 = document.getElementById('etapa1');
    if (et0) et0.style.display = 'none';
    if (et1) et1.style.display = 'block';
};

window.irParaEtapa3 = function() {
    const nomeEl = document.getElementById('compradorNome');
    const emailEl = document.getElementById('compradorEmail');
    const idiomaEl = document.getElementById('compradorIdioma');

    const nome = nomeEl ? nomeEl.value.trim() : "";
    const email = emailEl ? emailEl.value.trim() : "";
    const idioma = idiomaEl ? idiomaEl.value : "";

    if (!nome || !email || !idioma) {
        return alert("⚠️ Por favor, preencha todos os dados!");
    }

    const et1 = document.getElementById('etapa1');
    const et3 = document.getElementById('etapa3');
    if (et1) et1.style.display = 'none';
    if (et3) et3.style.display = 'block';
};

window.finalizarCompra = async function() {
    const fileInput = document.getElementById('comprovantePix');
    if (!fileInput || !fileInput.files[0]) {
        return alert("⚠️ Por favor, adicione a imagem do comprovante PIX!");
    }

    const file = fileInput.files[0];
    const nomeEl = document.getElementById('compradorNome');
    const emailEl = document.getElementById('compradorEmail');
    const idiomaEl = document.getElementById('compradorIdioma');

    const nome = nomeEl ? nomeEl.value.trim() : "";
    const email = emailEl ? emailEl.value.trim().toLowerCase() : "";
    const idioma = idiomaEl ? idiomaEl.value : "Português";

    try {
        const banidosSnap = await getDocs(collection(db, "banidos"));
        let banido = false;
        banidosSnap.forEach(d => {
            if (d.data().email === email) banido = true;
        });

        if (banido) {
            return alert("🚫 Seu e-mail está banido do sistema.");
        }
    } catch (e) {
        console.error("Erro ao verificar banidos:", e);
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const fotoBase64 = e.target.result;

        try {
            await addDoc(collection(db, "pedidos"), {
                meetupId: meetupSelecionadoId,
                nome: nome,
                email: email,
                idioma: idioma,
                comprovanteFoto: fotoBase64,
                status: "Aguardando Aprovação",
                dataPedido: new Date().toISOString()
            });

            const et3 = document.getElementById('etapa3');
            const et4 = document.getElementById('etapa4');
            if (et3) et3.style.display = 'none';
            if (et4) et4.style.display = 'block';

        } catch (err) {
            console.error("Erro ao enviar pedido:", err);
            alert("❌ Erro ao enviar comprovante. Tente novamente.");
        }
    };
    reader.readAsDataURL(file);
};

window.fecharCompra = function() {
    const modal = document.getElementById('compraModal');
    if (modal) modal.style.display = 'none';
};

window.fecharCompraEAtualizar = function() {
    window.fecharCompra();
    window.location.reload();
};

// --- PAINEL DEV & LOGIN ---
window.abrirDev = function() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) loginModal.style.display = 'flex';
};

window.verificarLogin = async function() {
    const emailEl = document.getElementById('emailInput');
    const senhaEl = document.getElementById('senhaInput');
    
    if (!emailEl || !senhaEl) return;
    
    const email = emailEl.value;
    const senha = senhaEl.value;

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        window.location.href = 'dev-settings.html';
    } catch (error) {
        alert("❌ Erro no Login: " + error.message);
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    carregarMeetups();
});
