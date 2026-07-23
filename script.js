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

// Variáveis de controle de compra
let tipoCompra = ""; // 'meetup' ou 'loja'
let meetupSelecionadoId = null;
let produtoSelecionadoId = null;
let produtoSelecionadoNome = null;
let produtoEstoqueAtual = 0;

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
    } else if (aba === 'loja') {
        const elAba = document.getElementById('aba-loja');
        const elBtn = document.getElementById('btn-loja');
        if (elAba) elAba.classList.add('ativa');
        if (elBtn) elBtn.classList.add('active');
    }
};

// --- CARREGAR LOJA VIP ---
window.abrirLojaVIP = async function() {
    window.mudarAba('loja');
    const container = document.getElementById('lista-produtos-loja');
    if (!container) return;
    
    container.innerHTML = "<p style='color: white;'>Carregando itens exclusivos...</p>";

    try {
        const snap = await getDocs(collection(db, "produtosLoja"));
        container.innerHTML = "";

        if (snap.empty) {
            container.innerHTML = "<p style='color: #d1b3ff;'>Nenhum item VIP disponível no momento.</p>";
            return;
        }

        const agora = new Date();

        snap.forEach(docSnap => {
            const item = docSnap.data();
            const dataValidade = item.validade ? new Date(item.validade) : null;
            const expirado = dataValidade && agora > dataValidade;

            if (!expirado) {
                const esgotado = item.estoque <= 0;
                const btnHtml = esgotado 
                    ? `<button class="btn-comprar btn-esgotado" disabled>ESGOTADO</button>` 
                    : `<button class="btn-comprar" onclick="window.pedirCodigoLoja('${docSnap.id}', '${item.nome}', ${item.estoque})">Comprar Item</button>`;

                container.innerHTML += `
                    <div class="item-lista">
                        <div>
                            <strong>${item.nome}</strong><br>
                            <small style="color: #ccc;">Valor: ${item.valor} | Estoque: ${item.estoque}</small>
                        </div>
                        ${btnHtml}
                    </div>
                `;
            }
        });
    } catch (error) {
        console.error("Erro ao carregar Loja VIP:", error);
        container.innerHTML = "<p style='color: #ff4444;'>Erro ao carregar produtos.</p>";
    }
};

// --- VERIFICAÇÃO DE CÓDIGO DA LOJA VIP ---
window.pedirCodigoLoja = async function(id, nome, estoque) {
    if (estoque <= 0) {
        return alert("❌ Ops! Este item já está esgotado.");
    }

    const codigoDigitado = prompt(`🔒 Item: ${nome}\n\nDigite o código de acesso da Loja VIP para continuar:`);
    if (!codigoDigitado) return; // Se cancelar, não faz nada

    try {
        // Valida o código no Firebase na coleção lojaConfig
        const configSnap = await getDocs(collection(db, "lojaConfig"));
        let codigoValido = false;

        configSnap.forEach(d => {
            const dados = d.data();
            // Verifica nos campos comuns onde o código costuma ficar salvo
            if ((dados.codigo && dados.codigo.trim() === codigoDigitado.trim()) ||
                (dados.senha && dados.senha.trim() === codigoDigitado.trim()) ||
                (dados.texto && dados.texto.trim() === codigoDigitado.trim())) {
                codigoValido = true;
            }
        });

        if (configSnap.empty) {
            return alert("⚠️ Nenhuma configuração de código encontrada no banco de dados.");
        }

        if (!codigoValido) {
            return alert("❌ Código de acesso incorreto!");
        }

        // Se o código estiver correto, abre as 4 etapas de compra!
        tipoCompra = 'loja';
        produtoSelecionadoId = id;
        produtoSelecionadoNome = nome;
        produtoEstoqueAtual = estoque;
        iniciarModal();

    } catch (err) {
        console.error("Erro ao validar código:", err);
        alert("❌ Erro ao validar o código no servidor.");
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
// JANELA DE 4 ETAPAS BLINDADA
// ==========================================

window.abrirModalCompraMeetup = function(id) {
    tipoCompra = 'meetup';
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

    // Checa se está banido
    try {
        const banidosSnap = await getDocs(collection(db, "banidos"));
        let banido = false;
        banidosSnap.forEach(d => {
            if (d.data().email === email) banido = true;
        });

        if (banido) {
            return alert("🚫 Seu e-mail está banido do sistema da Purple Studios.");
        }
    } catch (e) {
        console.error("Erro ao verificar banidos:", e);
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const fotoBase64 = e.target.result;

        try {
            if (tipoCompra === 'meetup') {
                await addDoc(collection(db, "pedidos"), {
                    meetupId: meetupSelecionadoId,
                    nome: nome,
                    email: email,
                    idioma: idioma,
                    comprovanteFoto: fotoBase64,
                    status: "Aguardando Aprovação",
                    dataPedido: new Date().toISOString()
                });
            } else if (tipoCompra === 'loja') {
                // Diminui o estoque do produto
                const produtoRef = doc(db, "produtosLoja", produtoSelecionadoId);
                await updateDoc(produtoRef, {
                    estoque: produtoEstoqueAtual - 1
                });

                // Salva o pedido na aba de pedidos da loja
                await addDoc(collection(db, "pedidosLojaVip"), {
                    produtoId: produtoSelecionadoId,
                    produtoNome: produtoSelecionadoNome,
                    nomeComprador: nome,
                    emailComprador: email,
                    idioma: idioma,
                    comprovanteFoto: fotoBase64,
                    status: "Aguardando Aprovação",
                    dataCompra: new Date().toISOString()
                });
            }

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
