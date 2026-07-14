import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-y0KtCLH0g65Q7nCb31avCx5G3iKekLc",
  authDomain: "purple-tickets.firebaseapp.com",
  projectId: "purple-tickets",
  storageBucket: "purple-tickets.firebasestorage.app",
  messagingSenderId: "808397510409",
  appId: "1:808397510409:web:cee298484e7f6db48da5d8",
  measurementId: "G-CSY3V2WCZL"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 

// ===================================
// 1. FUNÇÃO DAS ABAS
// ===================================
window.mudarAba = function(abaNome) {
    document.getElementById('aba-meetups').classList.remove('ativa');
    document.getElementById('aba-status').classList.remove('ativa');
    document.getElementById('btn-meetups').classList.remove('active');
    document.getElementById('btn-status').classList.remove('active');

    document.getElementById('aba-' + abaNome).classList.add('ativa');
    document.getElementById('btn-' + abaNome).classList.add('active');
};

window.carregarMeetups = async function() {
    const listaMeetups = document.getElementById('lista-meetups');
    const listaStatus = document.getElementById('lista-status');
    listaMeetups.innerHTML = "<p>Carregando...</p>"; 
    listaStatus.innerHTML = "<p>Carregando...</p>"; 

    try {
        const querySnapshot = await getDocs(collection(db, "meetups"));
        listaMeetups.innerHTML = ""; 
        listaStatus.innerHTML = ""; 
        
        querySnapshot.forEach((docSnap) => {
            const dados = docSnap.data();
            
            // Renderiza na aba Meetups
            listaMeetups.innerHTML += `
                <div style="background: #fff; border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="text-align:left;"><strong>${dados.nome}</strong><br><small>Data: ${dados.data}</small></div>
                    <div style="font-weight: bold; color: #32cd32;">R$ ${dados.preco}</div>
                    <button onclick="window.abrirCompra('${dados.nome}', '${dados.preco}', '${dados.linkMeet || ''}')" style="background: #7a28cb; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">Comprar</button>
                </div>
            `;

            // Renderiza na aba Status
            const msgStatus = dados.mensagemStatus || "Tudo certo para o evento! Sem atrasos.";
            listaStatus.innerHTML += `
                <div style="background: #fff; border: 2px solid #ffcc00; padding: 15px; margin: 10px 0; border-radius: 10px; text-align: left;">
                    <h3 style="margin: 0 0 5px 0; color: #2a0052;">${dados.nome}</h3>
                    <p style="margin: 0; color: #555;"><strong>Status do Dev:</strong> ${msgStatus}</p>
                </div>
            `;
        });
    } catch(e) {
        console.error("Erro ao carregar banco de dados: ", e);
        listaMeetups.innerHTML = "<p style='color: red;'>Erro ao carregar os eventos.</p>";
    }
};

// ===================================
// 2. MODAL DE LOGIN DEV (SEGURO)
// ===================================
window.abrirDev = function() { document.getElementById('loginModal').style.display = 'flex'; };
window.fecharModal = function() { document.getElementById('loginModal').style.display = 'none'; };

window.verificarLogin = async function() {
    let email = document.getElementById('emailInput').value.trim();
    let senha = document.getElementById('senhaInput').value;
    
    if(!email || !senha) return alert("Por favor, preencha e-mail e senha!");

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        window.location.href = "dev-settings.html";
    } catch (error) {
        alert("Acesso negado! E-mail ou senha incorretos.");
    }
};

// ===================================
// 3. FLUXO DE COMPRA E FORMULÁRIOS
// ===================================
let meetupAtual = "";
let precoAtual = "";
let linkMeetAtual = "";

window.abrirCompra = function(nome, preco, link) {
    meetupAtual = nome; precoAtual = preco; linkMeetAtual = link;
    document.getElementById('compraModal').style.display = 'flex';
    document.getElementById('etapa0').style.display = 'block';
    document.getElementById('etapa1').style.display = 'none';
    document.getElementById('etapa3').style.display = 'none';
    document.getElementById('etapa4').style.display = 'none';
};

window.fecharCompra = function() { document.getElementById('compraModal').style.display = 'none'; };
window.fecharCompraEAtualizar = function() { window.fecharCompra(); window.carregarMeetups(); };

window.irParaEtapa1 = function() {
    if (document.getElementById('checkTermos').checked && document.getElementById('checkReembolso').checked && document.getElementById('checkRegras').checked) {
        document.getElementById('etapa0').style.display = 'none'; 
        document.getElementById('etapa1').style.display = 'block';
    } else { 
        alert("Você precisa aceitar todos os termos e regras antes de prosseguir!"); 
    }
};

window.irParaEtapa3 = function() {
    let nome = document.getElementById('compradorNome').value.trim();
    let email = document.getElementById('compradorEmail').value.trim();
    let idioma = document.getElementById('compradorIdioma').value; 
    
    if(!nome || !email || !idioma) return alert("Preencha seu Nome Completo, Gmail e selecione um Idioma!"); 
    
    document.getElementById('etapa1').style.display = 'none'; 
    document.getElementById('etapa3').style.display = 'block';
};

window.finalizarCompra = async function() {
    let nome = document.getElementById('compradorNome').value.trim();
    let email = document.getElementById('compradorEmail').value.trim().toLowerCase(); 
    let idioma = document.getElementById('compradorIdioma').value; 
    let arquivoInput = document.getElementById('comprovantePix');

    if(!arquivoInput.files[0]) return alert("Anexe o print do comprovante do Pix!");

    // 1. VERIFICA O MARTELO DO BANIMENTO 🔨
    const q = query(collection(db, "banidos"), where("email", "==", email));
    const queryBanidos = await getDocs(q);
    if (!queryBanidos.empty) {
        alert("🚫 ACESSO NEGADO! Este e-mail foi banido pela administração por violação das regras.");
        return; 
    }

    // 2. COMPRESSÃO E ENVIO DO COMPROVANTE (ATUALIZADO)
    const reader = new FileReader();
    reader.onload = function(evento) {
        const img = new Image();
        img.onload = async function() {
            try {
                const canvas = document.createElement('canvas');
                // Mantém a proporção mas limita a largura para evitar estouro de memória
                const MAX_WIDTH = 600;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Converte com qualidade reduzida para garantir envio rápido
                const base64Foto = canvas.toDataURL('image/jpeg', 0.5); 

                // Verifica se gerou algo antes de enviar
                if (!base64Foto || base64Foto.length < 100) {
                    throw new Error("Falha na geração da imagem (Base64 vazio).");
                }

                // Atualiza o estado visual
                document.getElementById('etapa3').style.display = 'none';
                document.getElementById('etapa4').style.display = 'block';

                await addDoc(collection(db, "pedidos"), { 
                    meetup: meetupAtual, 
                    valor: precoAtual, 
                    nome: nome, 
                    email: email, 
                    idioma: idioma,
                    linkMeet: linkMeetAtual,
                    comprovanteFoto: base64Foto, 
                    status: "Aguardando Aprovação", 
                    dataPedido: new Date().toISOString()
                });
                
            } catch(e) { 
                alert("Erro ao processar imagem: " + e.message); 
                console.error(e);
            }
        };
        img.onerror = function() { alert("Erro ao carregar a imagem selecionada."); };
        img.src = evento.target.result;
    };
    reader.readAsDataURL(arquivoInput.files[0]);
};

// Execução direta ao carregar o módulo na página
window.carregarMeetups();
