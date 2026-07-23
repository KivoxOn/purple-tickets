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

// Variáveis para sabermos o que a pessoa está comprando
let tipoCompra = ""; // Vai ser 'meetup' ou 'loja'
let meetupSelecionadoId = null;
let produtoSelecionadoId = null;
let produtoSelecionadoNome = null;
let produtoEstoqueAtual = 0;

// --- NAVEGAÇÃO DE ABAS DO SITE ---
window.mudarAba = function(aba) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('ativa'));
    document.querySelectorAll('.btn-aba').forEach(el => el.classList.remove('active'));

    if (aba === 'meetups') {
        document.getElementById('aba-meetups').classList.add('ativa');
        document.getElementById('btn-meetups').classList.add('active');
    } else if (aba === 'status') {
        document.getElementById('aba-status').classList.add('ativa');
        document.getElementById('btn-status').classList.add('active');
    } else if (aba === 'loja') {
        document.getElementById('aba-loja').classList.add('ativa');
        document.getElementById('btn-loja').classList.add('active');
    }
};

// --- LOJA VIP ---
window.abrirLojaVIP = async function() {
    window.mudarAba('loja');
    const container = document.getElementById('lista-produtos-loja');
    container.innerHTML = "<p style='color: white;'>Carregando itens da loja...</p>";

    try {
        const snap = await getDocs(collection(db, "produtosLoja"));
        container.innerHTML = "";

        if (snap.empty) {
            container.innerHTML = "<p style='color: #d1b3ff;'>Nenhum item disponível no momento.</p>";
            return;
        }

        const agora = new Date();

        snap.forEach(docSnap => {
            const item = docSnap.data();
            const dataValidade = item.validade ? new Date(item.validade) : null;
            const expirado = dataValidade && agora > dataValidade;

            if (!expirado) {
                const esgotado = item.estoque <= 0;
                // Agora o botão chama a nova função que abre as 4 etapas!
                const btnHtml = esgotado 
                    ? `<button class="btn-comprar btn-esgotado" disabled>ESGOTADO</button>` 
                    : `<button class="btn-comprar" onclick="window.abrirModalCompraLoja('${docSnap.id}', '${item.nome}', ${item.estoque})">Comprar (PIX)</button>`;

                container.innerHTML += `
                    <div class="item-lista">
                        <div>
                            <strong>${item.nome}</strong><br>
                            <small style="color: #666;">Valor: ${item.valor} | Estoque: ${item.estoque}</small>
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
                            <small style="color: #555;">📅 ${m.data || 'A definir'} às ${m.horario || '--:--'} | R$ ${m.preco || '0'}</small>
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
// JANELA DE 4 ETAPAS (SERVE PARA MEETUPS E LOJA)
// ==========================================

// Prepara a janela para comprar um TICKET DE EVENTO
window.abrirModalCompraMeetup = function(id) {
    tipoCompra = 'meetup';
    meetupSelecionadoId = id;
    iniciarModal();
};

// Prepara a janela para comprar um PRODUTO DA LOJA
window.abrirModalCompraLoja = function(id, nome, estoque) {
    if (estoque <= 0) {
        return alert("❌ Ops! Este item já está esgotado.");
    }
    tipoCompra = 'loja';
    produtoSelecionadoId = id;
    produtoSelecionadoNome = nome;
    produtoEstoqueAtual = estoque;
    iniciarModal();
};

// Abre a janela do zero (Etapa 0)
function iniciarModal() {
    document.getElementById('compraModal').style.display = 'flex';
    document.getElementById('etapa0').style.display = 'block';
    document.getElementById('etapa1').style.display = 'none';
    document.getElementById('etapa3').style.display = 'none';
    document.getElementById('etapa4').style.display = 'none';

    document.getElementById('checkTermos').checked = false;
    document.getElementById('checkReembolso').checked = false;
    document.getElementById('checkRegras').checked = false;
}

window.irParaEtapa1 = function() {
    const cTermos = document.getElementById('checkTermos').checked;
    const cReembolso = document.getElementById('checkReembolso').checked;
    const cRegras = document.getElementById('checkRegras').checked;

    if (!cTermos || !cReembolso || !cRegras) {
        return alert("⚠️ Você precisa aceitar os Termos, o Reembolso e as Regras para continuar!");
    }

    document.getElementById('etapa0').style.display = 'none';
    document.getElementById('etapa1').style.display = 'block';
};

window.irParaEtapa3 = function() {
    const nome = document.getElementById('compradorNome').value.trim();
    const email = document.getElementById('compradorEmail').value.trim();
    const idioma = document.getElementById('compradorIdioma').value;

    if (!nome || !email || !idioma) {
        return alert("⚠️ Por favor, preencha todos os dados!");
    }

    document.getElementById('etapa1').style.display = 'none';
    document.getElementById('etapa3').style.display = 'block';
};

// Finaliza a compra enviando a foto do PIX
window.finalizarCompra = async function() {
    const fileInput = document.getElementById('comprovantePix');
    const file = fileInput.files[0];

    if (!file) {
        return alert("⚠️ Por favor, adicione a imagem do comprovante PIX!");
    }

    const nome = document.getElementById('compradorNome').value.trim();
    const email = document.getElementById('compradorEmail').value.trim().toLowerCase();
    const idioma = document.getElementById('compradorIdioma').value;

    // Verifica se o e-mail está banido
    const banidosSnap = await getDocs(collection(db, "banidos"));
    let banido = false;
    banidosSnap.forEach(d => {
        if (d.data().email === email) banido = true;
    });

    if (banido) {
        return alert("🚫 Seu e-mail está banido do sistema da Purple Studios e você não pode fazer compras.");
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const fotoBase64 = e.target.result;

        try {
            // Se for compra de TICKET DE MEETUP
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
            } 
            // Se for compra de PRODUTO DA LOJA VIP
            else if (tipoCompra === 'loja') {
                // Diminui 1 do estoque
                const produtoRef = doc(db, "produtosLoja", produtoSelecionadoId);
                await updateDoc(produtoRef, {
                    estoque: produtoEstoqueAtual - 1
                });

                // Salva o pedido na aba da loja
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

            // Vai para a tela de Sucesso!
            document.getElementById('etapa3').style.display = 'none';
            document.getElementById('etapa4').style.display = 'block';
            
        } catch (err) {
            console.error("Erro ao enviar pedido:", err);
            alert("❌ Erro ao enviar comprovante. Tente novamente.");
        }
    };
    reader.readAsDataURL(file);
};

window.fecharCompra = function() {
    document.getElementById('compraModal').style.display = 'none';
};

window.fecharCompraEAtualizar = function() {
    window.fecharCompra();
    window.location.reload();
};

// --- PAINEL DEV & LOGIN ---
window.abrirDev = function() {
    document.getElementById('loginModal').style.display = 'flex';
};

window.verificarLogin = async function() {
    const email = document.getElementById('emailInput').value;
    const senha = document.getElementById('senhaInput').value;

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        window.location.href = 'dev-settings.html';
    } catch (error) {
        alert("❌ Erro no Login: " + error.message);
    }
};

// Inicializa a página
document.addEventListener('DOMContentLoaded', () => {
    carregarMeetups();
});
