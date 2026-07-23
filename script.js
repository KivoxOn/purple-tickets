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

// --- LOJA VIP (SEM TRAVA DE APENAS 1 UNIDADE POR USUÁRIO) ---
window.abrirLojaVIP = async function() {
    window.mudarAba('loja');
    const container = document.getElementById('lista-produtos-loja');
    container.innerHTML = "<p style='color: white;'>Buscando itens no cofre...</p>";

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
                    : `<button class="btn-comprar" onclick="window.comprarProdutoLoja('${docSnap.id}', ${item.estoque}, '${item.nome}')">Comprar Item</button>`;

                container.innerHTML += `
                    <div class="item-lista">
                        <div>
                            <strong>${item.nome}</strong><br>
                            <small style="color: #666;">Valor: ${item.valor} | Estoque restante: ${item.estoque}</small>
                        </div>
                        ${btnHtml}
                    </div>
                `;
            }
        });
    } catch (error) {
        console.error("Erro ao carregar Loja VIP:", error);
        container.innerHTML = "<p style='color: #ff4444;'>Erro ao carregar produtos da Loja VIP.</p>";
    }
};

// COMPRA SEM LIMITES (O usuário pode comprar quantas vezes quiser enquanto houver estoque)
window.comprarProdutoLoja = async function(produtoId, estoqueAtual, nomeProduto) {
    if (estoqueAtual <= 0) {
        return alert("❌ Ops! Este item já está esgotado.");
    }

    const emailUsuario = prompt(`🛒 Comprando: ${nomeProduto}\n\nDigite seu e-mail para confirmar o pedido:`);
    if (!emailUsuario) return;

    try {
        // Checa se o usuário foi banido
        const banidosSnap = await getDocs(collection(db, "banidos"));
        let usuarioBanido = false;
        banidosSnap.forEach(docB => {
            if (docB.data().email === emailUsuario.toLowerCase().trim()) {
                usuarioBanido = true;
            }
        });

        if (usuarioBanido) {
            return alert("🚫 Este e-mail está suspenso e não pode realizar compras.");
        }

        // Subtrai 1 do estoque no Firebase
        const produtoRef = doc(db, "produtosLoja", produtoId);
        await updateDoc(produtoRef, {
            estoque: estoqueAtual - 1
        });

        // Grava o pedido
        await addDoc(collection(db, "pedidosLojaVip"), {
            produtoId: produtoId,
            produtoNome: nomeProduto,
            emailComprador: emailUsuario.toLowerCase().trim(),
            dataCompra: new Date().toISOString(),
            status: "Aguardando Pagamento"
        });

        alert(`🎉 Sucesso! Você garantiu o item: ${nomeProduto}!\nObrigado por apoiar a Purple Studios!`);
        window.abrirLojaVIP();

    } catch (error) {
        console.error("Erro na compra do produto VIP:", error);
        alert("❌ Erro ao processar o pedido. Tente novamente.");
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
                        <button class="btn-comprar" onclick="window.abrirModalCompra('${docSnap.id}')">Garantir Ticket</button>
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

// --- MODAL DE COMPRA DE INGRESSOS ---
window.abrirModalCompra = function(id) {
    meetupSelecionadoId = id;
    document.getElementById('compraModal').style.display = 'flex';
    document.getElementById('etapa0').style.display = 'block';
    document.getElementById('etapa1').style.display = 'none';
    document.getElementById('etapa3').style.display = 'none';
    document.getElementById('etapa4').style.display = 'none';

    document.getElementById('checkTermos').checked = false;
    document.getElementById('checkReembolso').checked = false;
    document.getElementById('checkRegras').checked = false;
};

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

window.finalizarCompra = async function() {
    const fileInput = document.getElementById('comprovantePix');
    const file = fileInput.files[0];

    if (!file) {
        return alert("⚠️ Por favor, adicione a imagem do comprovante PIX!");
    }

    const nome = document.getElementById('compradorNome').value.trim();
    const email = document.getElementById('compradorEmail').value.trim().toLowerCase();

    // Valida banidos
    const banidosSnap = await getDocs(collection(db, "banidos"));
    let banido = false;
    banidosSnap.forEach(d => {
        if (d.data().email === email) banido = true;
    });

    if (banido) {
        return alert("🚫 Seu e-mail está banido do sistema da Purple Studios.");
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const fotoBase64 = e.target.result;

        try {
            await addDoc(collection(db, "pedidos"), {
                meetupId: meetupSelecionadoId,
                nome: nome,
                email: email,
                idioma: document.getElementById('compradorIdioma').value,
                comprovanteFoto: fotoBase64,
                status: "Aguardando Aprovação",
                dataPedido: new Date().toISOString()
            });

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

// Carrega os meetups assim que a página é aberta
document.addEventListener('DOMContentLoaded', () => {
    carregarMeetups();
});
