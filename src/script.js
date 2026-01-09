// ============================================
// CAMBIO - MULTIJOUEUR LOCAL (2 JOUEURS)
// ============================================

const COULEURS = ['coeur', 'carreau', 'trefle', 'pique'];
const VALEURS = ['As', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valet', 'Dame', 'Roi'];

// État du jeu
let deck = [];
let mainJoueur1 = [];
let mainJoueur2 = [];
let pioche = [];
let defausse = [];
let joueurActif = 1; // 1 ou 2
let phaseInitiale = true;
let cartesVuesJ1 = [];
let cartesVuesJ2 = [];
let peekCountJ1 = 0;
let peekCountJ2 = 0;

// État de la pioche en cours
let cartePiochee = null;
let sourceCartePiochee = null;
let enAttenteAction = false;
let effetSpecialActif = null;

// État du Cambio
let cambioAnnonce = false;
let joueurCambio = null;
let dernierTour = false;

/**
 * Calcule les points d'une carte
 */
function calculerPoints(valeur, couleur) {
    if (valeur === 'Roi' && couleur === 'coeur') return -1;
    if (valeur === 'Roi') return 13;
    if (valeur === 'As') return 1;
    if (!isNaN(valeur)) return parseInt(valeur);
    if (valeur === 'Valet') return 11;
    if (valeur === 'Dame') return 12;
    return 0;
}

/**
 * Crée et mélange le deck
 */
function creerDeck() {
    const nouveauDeck = [];
    for (let couleur of COULEURS) {
        for (let valeur of VALEURS) {
            nouveauDeck.push({
                valeur, couleur,
                points: calculerPoints(valeur, couleur),
                id: `${valeur}_${couleur}`
            });
        }
    }
    return nouveauDeck;
}

function melangerDeck(deck) {
    const deckMelange = [...deck];
    for (let i = deckMelange.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckMelange[i], deckMelange[j]] = [deckMelange[j], deckMelange[i]];
    }
    return deckMelange;
}

/**
 * Distribue les cartes aux 2 joueurs
 */
function distribuerCartes() {
    mainJoueur1 = [];
    mainJoueur2 = [];
    defausse = [];
    pioche = [...deck];
    
    // 4 cartes pour chaque joueur
    for (let i = 0; i < 4; i++) {
        mainJoueur1.push(pioche.pop());
        mainJoueur2.push(pioche.pop());
    }
    
    defausse.push(pioche.pop());
    console.log(`🎴 Distribution : J1 = ${mainJoueur1.length}, J2 = ${mainJoueur2.length}, Pioche = ${pioche.length}`);
}

/**
 * Obtient la main du joueur actif
 */
function getMainActive() {
    return joueurActif === 1 ? mainJoueur1 : mainJoueur2;
}

function getMainAdverse() {
    return joueurActif === 1 ? mainJoueur2 : mainJoueur1;
}

/**
 * Symbole de couleur
 */
function getSymboleCouleur(couleur) {
    const symboles = { 'coeur': '♥', 'carreau': '♦', 'pique': '♠', 'trefle': '♣' };
    return symboles[couleur] || '';
}

/**
 * Affiche une carte
 */
function afficherCarte(carte, index, faceVisible = false, joueur = 1) {
    const carteDiv = document.createElement('div');
    carteDiv.className = 'card';
    carteDiv.dataset.index = index;
    carteDiv.dataset.joueur = joueur;
    
    if (faceVisible) {
        carteDiv.classList.add('card-front', `card-${carte.couleur}`);
        carteDiv.innerHTML = `
            <div class="card-value">${carte.valeur}</div>
            <div class="card-suit suit-${carte.couleur}">${getSymboleCouleur(carte.couleur)}</div>
            <div class="card-points">${carte.points} pts</div>
        `;
    } else {
        carteDiv.classList.add('card-back');
        carteDiv.innerHTML = '<div class="card-pattern"></div>';
    }
    
    return carteDiv;
}

/**
 * Affiche le plateau complet
 */
function afficherPlateau() {
    afficherMainJoueur(1);
    afficherMainJoueur(2);
    afficherCentrale();
    calculerEtAfficherScores();
    mettreAJourIndicateursTour();
}

/**
 * Affiche la main d'un joueur
 */
function afficherMainJoueur(joueur) {
    const handDiv = joueur === 1 ? document.getElementById('player-hand') : document.getElementById('player2-hand');
    const main = joueur === 1 ? mainJoueur1 : mainJoueur2;
    const cartesVues = joueur === 1 ? cartesVuesJ1 : cartesVuesJ2;
    const peekCount = joueur === 1 ? peekCountJ1 : peekCountJ2;
    
    handDiv.innerHTML = '';
    
    main.forEach((carte, index) => {
        const carteDiv = afficherCarte(carte, index, false, joueur);
        
        // Phase initiale : peek pour le joueur actif
        if (phaseInitiale && joueur === joueurActif && peekCount < 2) {
            carteDiv.classList.add('peekable');
            carteDiv.addEventListener('click', () => gererPeek(index, joueur));
        }
        // Effets spéciaux
        else if (effetSpecialActif && !phaseInitiale) {
            if (effetSpecialActif.type === 'regard' && joueur === joueurActif) {
                carteDiv.classList.add('selectable');
                carteDiv.addEventListener('click', () => regarderCarte(index, joueur));
            }
            else if (effetSpecialActif.type === 'valet') {
                carteDiv.classList.add('selectable');
                carteDiv.addEventListener('click', () => selectionnerPourValet(index, joueur));
            }
            else if (effetSpecialActif.type === 'dame') {
                // Étape 1 : Sélectionner une carte adverse
                if (effetSpecialActif.etape === 1 && joueur !== joueurActif) {
                    carteDiv.classList.add('selectable');
                    carteDiv.addEventListener('click', () => regarderEtEchangerDame(index, joueur));
                }
                // Étape 2 : Sélectionner sa propre carte
                else if (effetSpecialActif.etape === 2 && joueur === joueurActif) {
                    carteDiv.classList.add('selectable');
                    carteDiv.addEventListener('click', () => regarderEtEchangerDame(index, joueur));
                }
            }
        }
        // Échange normal
        else if (enAttenteAction && cartePiochee && joueur === joueurActif) {
            carteDiv.classList.add('exchangeable');
            carteDiv.addEventListener('click', () => echangerCarte(index));
        }
        
        handDiv.appendChild(carteDiv);
    });
}

/**
 * Affiche la zone centrale (pioche/défausse)
 */
function afficherCentrale() {
    // Défausse
    const defausseDiv = document.getElementById('defausse');
    defausseDiv.innerHTML = '';
    if (defausse.length > 0) {
        const carteDefausse = afficherCarte(defausse[defausse.length - 1], -1, true);
        
        if (!phaseInitiale && !enAttenteAction && !effetSpecialActif) {
            carteDefausse.classList.add('piochable');
            carteDefausse.addEventListener('click', piocherDefausse);
        }
        
        defausseDiv.appendChild(carteDefausse);
    }
    
    // Pioche
    const piocheDiv = document.getElementById('pioche');
    piocheDiv.innerHTML = '';
    if (pioche.length > 0) {
        const carteDos = document.createElement('div');
        carteDos.className = 'card card-back';
        carteDos.innerHTML = '<div class="card-pattern"></div>';
        
        if (!phaseInitiale && !enAttenteAction && !effetSpecialActif) {
            carteDos.classList.add('piochable');
            carteDos.addEventListener('click', piocherPioche);
        }
        
        piocheDiv.appendChild(carteDos);
        
        const countSpan = document.createElement('span');
        countSpan.className = 'deck-count';
        countSpan.textContent = pioche.length;
        piocheDiv.appendChild(countSpan);
    }
}

/**
 * Gère le peek initial
 */
function gererPeek(index, joueur) {
    if (!phaseInitiale) return;
    
    const cartesVues = joueur === 1 ? cartesVuesJ1 : cartesVuesJ2;
    const peekCount = joueur === 1 ? peekCountJ1 : peekCountJ2;
    
    if (peekCount >= 2 || cartesVues.includes(index)) return;
    
    const carteDiv = document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`);
    const main = joueur === 1 ? mainJoueur1 : mainJoueur2;
    const carte = main[index];
    
    cartesVues.push(index);
    if (joueur === 1) peekCountJ1++; else peekCountJ2++;
    
    carteDiv.classList.add('flipping', 'peeked');
    setTimeout(() => {
        carteDiv.className = `card card-front peeked card-${carte.couleur}`;
        carteDiv.innerHTML = `
            <div class="card-value">${carte.valeur}</div>
            <div class="card-suit suit-${carte.couleur}">${getSymboleCouleur(carte.couleur)}</div>
            <div class="card-points">${carte.points} pts</div>
        `;
    }, 300);
    
    setTimeout(() => {
        carteDiv.classList.add('flipping');
        setTimeout(() => {
            carteDiv.className = 'card card-back';
            carteDiv.innerHTML = '<div class="card-pattern"></div>';
            
            const newPeekCount = joueur === 1 ? peekCountJ1 : peekCountJ2;
            if (newPeekCount >= 2) {
                changerJoueurInitial();
            }
        }, 300);
    }, 3000);
    
    const restant = 2 - (joueur === 1 ? peekCountJ1 : peekCountJ2);
    updateMessage(`Joueur ${joueur} : Sélectionnez encore ${restant} carte(s)`);
}

/**
 * Change de joueur pendant la phase initiale
 */
function changerJoueurInitial() {
    if (peekCountJ1 >= 2 && peekCountJ2 >= 2) {
        // Les 2 joueurs ont vu leurs cartes
        setTimeout(() => {
            phaseInitiale = false;
            joueurActif = 1;
            afficherPlateau();
            updateMessage(`Joueur 1 : Piochez une carte pour commencer`);
            document.getElementById('btn-cambio').style.display = 'inline-block';
        }, 3500);
    } else if (joueurActif === 1 && peekCountJ1 >= 2) {
        // J1 a fini, on passe à J2
        setTimeout(() => {
            afficherTransition(2, "C'est au tour du Joueur 2 de regarder ses cartes");
        }, 3500);
    }
}

/**
 * Pioche dans la pioche
 */
function piocherPioche() {
    if (pioche.length === 0) {
        updateMessage("La pioche est vide !");
        return;
    }
    
    cartePiochee = pioche.pop();
    sourceCartePiochee = 'pioche';
    enAttenteAction = true;
    
    console.log(`🎴 J${joueurActif} pioche : ${cartePiochee.valeur} de ${cartePiochee.couleur}`);
    afficherCartePiochee();
    afficherPlateau();
}

/**
 * Pioche dans la défausse
 */
function piocherDefausse() {
    if (defausse.length === 0) return;
    
    cartePiochee = defausse.pop();
    sourceCartePiochee = 'defausse';
    enAttenteAction = true;
    
    console.log(`🗑️ J${joueurActif} prend de la défausse : ${cartePiochee.valeur}`);
    afficherCartePiochee();
    afficherPlateau();
}

/**
 * Affiche la carte piochée
 */
function afficherCartePiochee() {
    const centerArea = document.querySelector('.center-area');
    
    let piocheeContainer = document.getElementById('carte-piochee-container');
    if (!piocheeContainer) {
        piocheeContainer = document.createElement('div');
        piocheeContainer.id = 'carte-piochee-container';
        piocheeContainer.className = 'carte-piochee-container';
        centerArea.appendChild(piocheeContainer);
    }
    
    piocheeContainer.innerHTML = '';
    
    const carteDiv = afficherCarte(cartePiochee, -2, true);
    carteDiv.classList.add('carte-piochee');
    piocheeContainer.appendChild(carteDiv);
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'carte-piochee-actions';
    
    const btnEchanger = document.createElement('button');
    btnEchanger.className = 'btn btn-exchange';
    btnEchanger.textContent = '🔄 Échanger';
    btnEchanger.onclick = activerModeEchange;
    
    actionsDiv.appendChild(btnEchanger);
    
    // RÈGLE : On ne peut pas défausser une carte qui vient de la défausse
    if (sourceCartePiochee !== 'defausse') {
        const btnDefausser = document.createElement('button');
        btnDefausser.className = 'btn btn-discard';
        btnDefausser.textContent = '🗑️ Défausser';
        btnDefausser.onclick = defausserCartePiochee;
        actionsDiv.appendChild(btnDefausser);
    }
    
    piocheeContainer.appendChild(actionsDiv);
    
    if (sourceCartePiochee === 'defausse') {
        updateMessage(`Joueur ${joueurActif} : Vous devez échanger cette carte (impossible de défausser une carte de la défausse)`);
    } else {
        updateMessage(`Joueur ${joueurActif} : Choisissez Échanger ou Défausser`);
    }
}

/**
 * Active le mode échange
 */
function activerModeEchange() {
    updateMessage(`Joueur ${joueurActif} : Cliquez sur une de vos cartes pour l'échanger`);
    afficherPlateau();
}

/**
 * Échange la carte piochée
 */
function echangerCarte(index) {
    const main = getMainActive();
    const carteRemplacee = main[index];
    main[index] = cartePiochee;
    defausse.push(carteRemplacee);
    
    console.log(`🔄 J${joueurActif} échange : ${cartePiochee.valeur} remplace ${carteRemplacee.valeur}`);
    
    document.getElementById('carte-piochee-container')?.remove();
    cartePiochee = null;
    enAttenteAction = false;
    
    finirTour();
}

/**
 * Défausse la carte piochée
 */
function defausserCartePiochee() {
    defausse.push(cartePiochee);
    console.log(`🗑️ J${joueurActif} défausse : ${cartePiochee.valeur}`);
    
    const valeur = cartePiochee.valeur;
    
    document.getElementById('carte-piochee-container')?.remove();
    cartePiochee = null;
    enAttenteAction = false;
    
    // Vérifier effets spéciaux
    if (['8', '9', '10'].includes(valeur)) {
        activerEffetRegard();
    } else if (valeur === 'Valet') {
        activerEffetValet();
    } else if (valeur === 'Dame') {
        activerEffetDame();
    } else {
        finirTour();
    }
}

/**
 * Effet 8-9-10 : Regarder une de ses cartes
 */
function activerEffetRegard() {
    effetSpecialActif = { type: 'regard' };
    updateMessage(`✨ Joueur ${joueurActif} : Regardez une de vos cartes`);
    afficherPlateau();
}

function regarderCarte(index, joueur) {
    if (joueur !== joueurActif) return;
    
    const main = getMainActive();
    const carte = main[index];
    const carteDiv = document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`);
    
    carteDiv.classList.add('flipping');
    setTimeout(() => {
        carteDiv.className = `card card-front card-${carte.couleur}`;
        carteDiv.innerHTML = `
            <div class="card-value">${carte.valeur}</div>
            <div class="card-suit suit-${carte.couleur}">${getSymboleCouleur(carte.couleur)}</div>
            <div class="card-points">${carte.points} pts</div>
        `;
    }, 300);
    
    setTimeout(() => {
        carteDiv.classList.add('flipping');
        setTimeout(() => {
            effetSpecialActif = null;
            finirTour();
        }, 300);
    }, 3000);
}

/**
 * Effet Valet : Échanger 2 cartes SANS LES REGARDER
 * RÈGLE : Les cartes doivent rester face cachée pendant tout l'effet
 */
function activerEffetValet() {
    effetSpecialActif = { type: 'valet', selection: [] };
    updateMessage(`🃏 Joueur ${joueurActif} : Sélectionnez 2 cartes à échanger SANS LES REGARDER (vos cartes ou celles de l'adversaire)`);
    afficherPlateau();
}

function selectionnerPourValet(index, joueur) {
    const selection = effetSpecialActif.selection;
    const key = `${joueur}-${index}`;
    
    // Vérifier si déjà sélectionné
    const indexInSelection = selection.findIndex(s => s.key === key);
    if (indexInSelection >= 0) {
        // Désélectionner
        selection.splice(indexInSelection, 1);
        document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`).classList.remove('selected');
    } else if (selection.length < 2) {
        // Sélectionner (SANS révéler la carte - elle reste face cachée)
        selection.push({ joueur, index, key });
        document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`).classList.add('selected');
    }
    
    if (selection.length === 2) {
        // Échanger les 2 cartes (toujours face cachée)
        const [c1, c2] = selection;
        const main1 = c1.joueur === 1 ? mainJoueur1 : mainJoueur2;
        const main2 = c2.joueur === 1 ? mainJoueur1 : mainJoueur2;
        
        [main1[c1.index], main2[c2.index]] = [main2[c2.index], main1[c1.index]];
        
        console.log(`🃏 Valet : Échange J${c1.joueur}[${c1.index}] ↔ J${c2.joueur}[${c2.index}] (SANS regarder)`);
        
        effetSpecialActif = null;
        setTimeout(() => finirTour(), 500);
    } else {
        updateMessage(`🃏 Sélectionnez encore ${2 - selection.length} carte(s) - Les cartes restent CACHÉES`);
    }
}

/**
 * Effet Dame : Regarder une carte adverse et l'échanger
 */
function activerEffetDame() {
    effetSpecialActif = { type: 'dame' };
    updateMessage(`👸 Joueur ${joueurActif} : Cliquez sur une carte de l'adversaire pour la regarder`);
    afficherPlateau();
}

function regarderEtEchangerDame(index, joueur) {
    const main = getMainAdverse();
    const carte = main[index];
    const carteDiv = document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`);
    
    carteDiv.classList.add('flipping');
    setTimeout(() => {
        carteDiv.className = `card card-front card-${carte.couleur}`;
        carteDiv.innerHTML = `
            <div class="card-value">${carte.valeur}</div>
            <div class="card-suit suit-${carte.couleur}">${getSymboleCouleur(carte.couleur)}</div>
            <div class="card-points">${carte.points} pts</div>
        `;
        
        setTimeout(() => {
            const echanger = confirm(`Cette carte vaut ${carte.points} pts. Voulez-vous l'échanger avec une de vos cartes ?`);
            
            if (echanger) {
                const mesCartes = getMainActive();
                const monIndex = Math.floor(Math.random() * mesCartes.length);
                [mesCartes[monIndex], main[index]] = [main[index], mesCartes[monIndex]];
                console.log(`👸 Dame : Échange effectué`);
            }
            
            effetSpecialActif = null;
            finirTour();
        }, 2000);
    }, 300);
}

/**
 * Termine le tour et passe au joueur suivant
 */
function finirTour() {
    if (dernierTour) {
        // Dernier tour terminé, révéler les cartes
        revelerCartes();
        return;
    }
    
    afficherTransition(joueurActif === 1 ? 2 : 1);
}

/**
 * Affiche l'écran de transition
 */
function afficherTransition(prochainJoueur, message = null) {
    const transition = document.getElementById('turn-transition');
    const title = document.getElementById('transition-title');
    const msg = document.getElementById('transition-message');
    
    title.textContent = `Au tour du Joueur ${prochainJoueur}`;
    msg.textContent = message || `Passez l'appareil au Joueur ${prochainJoueur}`;
    
    transition.style.display = 'flex';
}

/**
 * Commence le tour du joueur
 */
function commencerTour() {
    const transition = document.getElementById('turn-transition');
    transition.style.display = 'none';
    
    afficherPlateau();
    updateMessage(`Joueur ${joueurActif} : Piochez une carte`);
}

/**
 * Met à jour les indicateurs de tour
 */
function mettreAJourIndicateursTour() {
    const ind1 = document.getElementById('player1-indicator');
    const ind2 = document.getElementById('player2-indicator');
    
    if (joueurActif === 1) {
        ind1.textContent = '← Votre tour';
        ind1.classList.add('active');
        ind2.textContent = '';
        ind2.classList.remove('active');
    } else {
        ind1.textContent = '';
        ind1.classList.remove('active');
        ind2.textContent = '← Votre tour';
        ind2.classList.add('active');
    }
}

/**
 * Calcule et affiche les scores
 */
function calculerEtAfficherScores() {
    const score1 = mainJoueur1.reduce((t, c) => t + c.points, 0);
    const score2 = mainJoueur2.reduce((t, c) => t + c.points, 0);
    
    document.getElementById('player1-score').textContent = score1;
    document.getElementById('player2-score').textContent = score2;
    document.getElementById('current-score').textContent = joueurActif === 1 ? score1 : score2;
}

/**
 * Annonce Cambio
 */
function annoncerCambio() {
    if (cambioAnnonce) return;
    
    cambioAnnonce = true;
    joueurCambio = joueurActif;
    dernierTour = true;
    
    updateMessage(`🎺 Joueur ${joueurActif} annonce CAMBIO ! Dernier tour pour l'adversaire !`);
    document.getElementById('btn-cambio').style.display = 'none';
    
    finirTour();
}

/**
 * Révèle toutes les cartes et détermine le gagnant
 */
function revelerCartes() {
    // Révéler toutes les cartes
    mainJoueur1.forEach((carte, i) => {
        const div = document.querySelector(`[data-joueur="1"][data-index="${i}"]`);
        if (div) {
            div.className = `card card-front card-${carte.couleur}`;
            div.innerHTML = `
                <div class="card-value">${carte.valeur}</div>
                <div class="card-suit suit-${carte.couleur}">${getSymboleCouleur(carte.couleur)}</div>
                <div class="card-points">${carte.points} pts</div>
            `;
        }
    });
    
    mainJoueur2.forEach((carte, i) => {
        const div = document.querySelector(`[data-joueur="2"][data-index="${i}"]`);
        if (div) {
            div.className = `card card-front card-${carte.couleur}`;
            div.innerHTML = `
                <div class="card-value">${carte.valeur}</div>
                <div class="card-suit suit-${carte.couleur}">${getSymboleCouleur(carte.couleur)}</div>
                <div class="card-points">${carte.points} pts</div>
            `;
        }
    });
    
    const score1 = mainJoueur1.reduce((t, c) => t + c.points, 0);
    const score2 = mainJoueur2.reduce((t, c) => t + c.points, 0);
    
    let message = `Scores finaux : Joueur 1 = ${score1} pts, Joueur 2 = ${score2} pts. `;
    
    if (score1 < score2) {
        message += joueurCambio === 1 ? '🏆 Joueur 1 GAGNE !' : '❌ Joueur 1 gagne ! Joueur 2 perd car il a annoncé Cambio à tort.';
    } else if (score2 < score1) {
        message += joueurCambio === 2 ? '🏆 Joueur 2 GAGNE !' : '❌ Joueur 2 gagne ! Joueur 1 perd car il a annoncé Cambio à tort.';
    } else {
        message += '🤝 ÉGALITÉ !';
    }
    
    updateMessage(message);
    console.log(message);
}

/**
 * Met à jour le message
 */
function updateMessage(message) {
    document.getElementById('game-message').textContent = message;
}

/**
 * Initialise le jeu
 */
function initialiserJeu() {
    console.clear();
    console.log('═══════════════════════════════════');
    console.log('  🎮 CAMBIO - 2 JOUEURS LOCAL    ');
    console.log('═══════════════════════════════════\n');
    
    phaseInitiale = true;
    joueurActif = 1;
    cartesVuesJ1 = [];
    cartesVuesJ2 = [];
    peekCountJ1 = 0;
    peekCountJ2 = 0;
    cartePiochee = null;
    enAttenteAction = false;
    effetSpecialActif = null;
    cambioAnnonce = false;
    joueurCambio = null;
    dernierTour = false;
    
    deck = creerDeck();
    deck = melangerDeck(deck);
    distribuerCartes();
    afficherPlateau();
    
    updateMessage("Joueur 1 : Sélectionnez 2 cartes à mémoriser");
    
    document.getElementById('carte-piochee-container')?.remove();
    document.getElementById('btn-cambio').style.display = 'none';
    document.getElementById('turn-transition').style.display = 'none';
}

// ============================================
// INITIALISATION
// ============================================

window.addEventListener('DOMContentLoaded', () => {
    initialiserJeu();
    
    document.getElementById('btn-nouvelle-partie').addEventListener('click', () => {
        if (confirm('Nouvelle partie ?')) initialiserJeu();
    });
    
    document.getElementById('btn-cambio').addEventListener('click', annoncerCambio);
    
    document.getElementById('btn-start-turn').addEventListener('click', () => {
        joueurActif = joueurActif === 1 ? 2 : 1;
        commencerTour();
    });
});

window.cambio = {
    initialiserJeu,
    getMainJoueur1: () => mainJoueur1,
    getMainJoueur2: () => mainJoueur2,
    getPioche: () => pioche,
    getDefausse: () => defausse
};