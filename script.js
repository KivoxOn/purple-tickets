import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
// Importamos updateDoc para atualizar o estoque na hora
import { getFirestore, collection, getDocs, addDoc, query, where, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
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

window.mudarAba = function(abaNome) {
    document.getElementById('aba-meetups').classList.remove('ativa');
    document.getElementById('aba-status').classList.remove('ativa');
    document.getElementById('aba-loja').classList.remove('ativa'); 
    
    document.getElementById('btn-meetups').classList.remove('active');
    document.getElementById('btn-status').classList.remove('active');

    document.getElementById('aba-' + abaNome).classList.add('ativa');
    if (document.getElementById('btn-' + abaNome)) {
        document.getElementById('btn-' + abaNome).classList.add('active');
    }
};

// ===================================
// SISTEMA DA LOJA VIP E ANTI-ROUBO
// ===================================
window.abrirLojaVIP = async function() {
    const codigoDigitado = prompt("🔒 Área Restrita!\nDigite o código de acesso exclusivo:");
    if (!codigoDigitado) return;

    try {
        const docSnap = await getDoc(doc(db, "lojaConfig", "acesso"));
        if (docSnap.exists() && codigoDigitado.trim() === docSnap.data().codigo) {
            alert("🎉 Acesso Liberado! Bem-vindo à Loja Secreta!");
            window.mudarAba('loja');
            window.carregarItensDaLoja(); // Chama a função para renderizar os produtos
        } else {
            alert("❌ Código incorreto! O acesso é exclusivo.");
        }
    } catch(e) { console.error(e); alert("Erro ao checar senha."); }
};

window.carregarItensDaLoja = async function() {
    const container = document.getElementById('lista-produtos-loja');
    container.innerHTML = "<p style='color: white;'>Carregando itens valiosos...</p>";

    try {
        const snap = await getDocs(collection(db, "produtosLoja"));
        container.innerHTML = "";
        
        const agora = new Date(); // Pega data e hora atual

        snap.forEach(docSnap => {
            const d = docSnap.data();
            const validadeItem = new Date(d.validade);

            // Verifica a Validade. Se já passou, nem renderiza o item no site (ele "some")
            if (agora > validadeItem) return; 

            // Se o estoque for zero, mostra esgotado
            let btnHTML = '';
            if (d.estoque > 0) {
                btnHTML = `<button class="btn-comprar" style="background: #ff00ff;" onclick="window.resgatarProduto('${docSnap.id}', '${d.nome}', ${d.estoque})">Resgatar</button>`;
            } else {
                btnHTML = `<button class="btn-comprar btn-esgotado" disabled>Esgotado</button>`;
            }

            container.innerHTML += `
                <div class="item-lista" style="background: #2a0052; color: white; border: 1px solid #7a28cb;">
                    <div>
                        <div style="font-size: 16px; font-weight: 900; color: #ffcc00;">${d.nome}</div>
                        <div style="font-size: 13px; color: #d1b3ff;">Valor: ${d.valor} | Restam: ${d.estoque}</div>
                    </div>
                    ${btnHTML}
                </div>
            `;
        });

        if (container.innerHTML === "") {
            container.innerHTML = "<p style='color: #aaa;'>A loja está vazia ou os itens expiraram. Volte mais tarde!</p>";
        }
    } catch(e) {
        console.error(e);
        container.innerHTML = "<p style='color: red;'>Erro ao carregar a loja.</p>";
    }
};

// 🛡️ O SISTEMA ANTI-ROUBO MÁGICO 🛡️
window.resgatarProduto = async function(idProduto, nomeProduto, estoqueAtual) {
    if (estoqueAtual <= 0) return alert("Infelizmente acabou o estoque deste item!");

    const emailDigitado = prompt(`🛍️ Resgatando: ${nomeProduto}\n\nSISTEMA ANTI-ROUBO ATIVADO:\nPara provar que você é um VIP, digite o E-MAIL exato que você usou na compra do ingresso:`);
    if (!emailDigitado) return;

    const email = emailDigitado.trim().toLowerCase();

    try {
        // PASSO 1: O cara comprou ingresso e foi Aprovado?
        const qPedidos = query(collection(db, "pedidos"), where("email", "==", email), where("status", "==", "Aprovado"));
        const pedidosSnap = await getDocs(qPedidos);

        if (pedidosSnap.empty) {
            return alert("❌ ACESSO NEGADO: Não encontramos nenhum ingresso aprovado para este e-mail. Roubar itens é feio!");
        }

        // PASSO 2: O cara já pegou ESSE item antes? (Para ele não limpar a loja sozinho)
        const qResgates = query(collection(db, "resgates"), where("email", "==", email), where("idProduto", "==", idProduto));
        const resgatesSnap = await getDocs(qResgates);

        if (!resgatesSnap.empty) {
            return alert("⚠️ Você já resgatou este item! Deixe um pouco para os outros.");
        }

        // PASSO 3: Tudo certo! Subtrai do estoque e salva o resgate no banco
        const refProduto = doc(db, "produtosLoja", idProduto);
        await updateDoc(refProduto, { estoque: estoqueAtual - 1 });

        await addDoc(collection(db, "resgates"), {
            email: email,
            produto: nomeProduto,
            idProduto: idProduto,
            dataResgate: new Date().toISOString()
        });

        alert(`🎉 SUCESSO!\nVocê resgatou "${nomeProduto}".\nA administração da Purple Studios entrará em contato ou enviará o item no seu e-mail em breve!`);
        
        // Atualiza a tela pra mostrar o estoque caindo
        window.carregarItensDaLoja();

    } catch(e) {
        console.error(e);
        alert("Erro no servidor durante o resgate. Tente novamente!");
    }
};

// ===================================
// FLUXO DE MEETUPS (Mantido igual)
// ===================================
window.carregarMeetups = async function() {
    const listaMeetups = document.getElementById('lista-meetups');
    const listaStatus = document.getElementById('lista-status');
    listaMeetups.innerHTML = "<p>Carregando...</p>"; listaStatus.innerHTML = "<p>Carregando...</p>"; 

    try {
        const querySnapshot = await getDocs(collection(db, "meetups"));
        listaMeetups.innerHTML = ""; listaStatus.innerHTML = ""; 
        
        querySnapshot.forEach((docSnap) => {
            const dados = docSnap.data();
            listaMeetups.innerHTML += `
                <div style="background: #fff; border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="text-align:left;"><strong>${dados.nome}</strong><br><small>Data: ${dados.data}</small></div>
                    <div style="font-weight: bold; color: #32cd32;">R$ ${dados.preco}</div>
                    <button onclick="window.abrirCompra('${dados.nome}', '${dados.preco}', '${dados.linkMeet || ''}')" style="background: #7a28cb; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">Comprar</button>
                </div>
            `;
            const msgStatus = dados.mensagemStatus || "Tudo certo para o evento! Sem atrasos.";
            listaStatus.innerHTML += `
                <div style="background: #fff; border: 2px solid #ffcc00; padding: 15px; margin: 10px 0; border-radius: 10px; text-align: left;">
                    <h3 style="margin: 0 0 5px 0; color: #2a0052;">${dados.nome}</h3>
                    <p style="margin: 0; color: #555;"><strong>Status do Dev:</strong> ${msgStatus}</p>
                </div>
            `;
        });
    } catch(e) { listaMeetups.innerHTML = "<p style='color: red;'>Erro ao carregar os eventos.</p>"; }
};

window.abrirDev = function() { document.getElementById('loginModal').style.display = 'flex'; };
window.verificarLogin = async function() {
    let email = document.getElementById('emailInput').value.trim();
    let senha = document.getElementById('senhaInput').value;
    if(!email || !senha) return alert("Preencha e-mail e senha!");
    try {
        await signInWithEmailAndPassword(auth, email, senha);
        window.location.href = "dev-settings.html";
    } catch (error) { alert("Acesso negado!"); }
};

let meetupAtual = ""; let precoAtual = ""; let linkMeetAtual = "";
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
        document.getElementById('etapa0').style.display = 'none'; document.getElementById('etapa1').style.display = 'block';
    } else { alert("Você precisa aceitar os termos!"); }
};

window.irParaEtapa3 = function() {
    if(!document.getElementById('compradorNome').value || !document.getElementById('compradorEmail').value || !document.getElementById('compradorIdioma').value) return alert("Preencha tudo!"); 
    document.getElementById('etapa1').style.display = 'none'; document.getElementById('etapa3').style.display = 'block';
};

window.finalizarCompra = async function() {
    let nome = document.getElementById('compradorNome').value.trim();
    let email = document.getElementById('compradorEmail').value.trim().toLowerCase(); 
    let idioma = document.getElementById('compradorIdioma').value; 
    let arquivoInput = document.getElementById('comprovantePix');

    if(!arquivoInput.files[0]) return alert("Anexe o print do comprovante!");

    const q = query(collection(db, "banidos"), where("email", "==", email));
    const queryBanidos = await getDocs(q);
    if (!queryBanidos.empty) { return alert("🚫 ACESSO NEGADO! E-mail banido."); }

    const reader = new FileReader();
    reader.onload = function(evento) {
        const img = new Image();
        img.onload = async function() {
            try {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; let width = img.width; let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                const base64Foto = canvas.toDataURL('image/jpeg', 0.5); 

                document.getElementById('etapa3').style.display = 'none'; document.getElementById('etapa4').style.display = 'block';

                await addDoc(collection(db, "pedidos"), { 
                    meetup: meetupAtual, valor: precoAtual, nome: nome, email: email, idioma: idioma,
                    linkMeet: linkMeetAtual, comprovanteFoto: base64Foto, status: "Aguardando Aprovação", dataPedido: new Date().toISOString()
                });
            } catch(e) { alert("Erro ao processar imagem."); }
        };
        img.src = evento.target.result;
    };
    reader.readAsDataURL(arquivoInput.files[0]);
};

window.carregarMeetups();
