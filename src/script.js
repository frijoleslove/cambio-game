// ============================================
// CAMBIO - MULTIJOUEUR LOCAL (2 JOUEURS)
// Version corrigée avec règles authentiques
// ============================================

const COULEURS = ['coeur', 'carreau', 'trefle', 'pique'];
const VALEURS = ['As', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valet', 'Dame', 'Roi'];

// État du jeu
let deck = [];
let mainJoueur1 = [];
let mainJoueur2 = [];
let pioche = [];
let defausse = [];
let joueurActif = 1;
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
 * RÈGLE MODIFIÉE : La défausse commence VIDE
 */
function distribuerCartes() {
    mainJoueur1 = [];
    mainJoueur2 = [];
    defausse = []; // VIDE au début !
    pioche = [...deck];
    
    // 4 cartes pour chaque joueur
    for (let i = 0; i < 4; i++) {
        mainJoueur1.push(pioche.pop());
        mainJoueur2.push(pioche.pop());
    }
    
    // PAS de carte dans la défausse au début
    console.log(`🎴 Distribution : J1 = ${mainJoueur1.length}, J2 = ${mainJoueur2.length}, Pioche = ${pioche.length}, Défausse = VIDE`);
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
    const peekCount = joueur === 1 ? peekCountJ1 : peekCountJ2;
    const cartesVues = joueur === 1 ? cartesVuesJ1 : cartesVuesJ2;
    
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
                // Étape 1 : Regarder une carte adverse
                if (effetSpecialActif.etape === 1 && joueur !== joueurActif) {
                    carteDiv.classList.add('selectable');
                    carteDiv.addEventListener('click', () => regarderCarteAdverseDame(index, joueur));
                }
                // Étape 2 : Choisir sa propre carte pour l'échange (optionnel)
                else if (effetSpecialActif.etape === 2 && joueur === joueurActif) {
                    carteDiv.classList.add('exchangeable');
                    carteDiv.addEventListener('click', () => echangerAvecAdverseDame(index));
                }
            }
        }
        // Échange normal (après avoir pioché)
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
        
        // On peut piocher de la défausse SEULEMENT si elle n'est pas vide
        // et qu'on n'est pas en phase initiale ou en attente d'action
        if (!phaseInitiale && !enAttenteAction && !effetSpecialActif) {
            carteDefausse.classList.add('piochable');
            carteDefausse.addEventListener('click', piocherDefausse);
        }
        
        defausseDiv.appendChild(carteDefausse);
    } else {
        // Défausse vide - afficher un placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'card defausse-vide';
        placeholder.innerHTML = '<span class="placeholder-text">Défausse vide</span>';
        defausseDiv.appendChild(placeholder);
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
    updateMessage(`Joueur ${joueur} : Sélectionnez encore ${restant} carte(s) à mémoriser`);
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
            updateMessage(`Joueur 1 : Piochez une carte de la pioche pour commencer`);
            document.getElementById('btn-cambio').style.display = 'inline-block';
        }, 3500);
    } else if (joueurActif === 1 && peekCountJ1 >= 2) {
        // J1 a fini, on passe à J2
        setTimeout(() => {
            afficherTransition(2, "C'est au tour du Joueur 2 de regarder ses 2 cartes");
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
    if (defausse.length === 0) {
        updateMessage("La défausse est vide !");
        return;
    }
    
    cartePiochee = defausse.pop();
    sourceCartePiochee = 'defausse';
    enAttenteAction = true;
    
    console.log(`🗑️ J${joueurActif} prend de la défausse : ${cartePiochee.valeur}`);
    afficherCartePiochee();
    afficherPlateau();
}

/**
 * Affiche la carte piochée avec les options
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
    
    // Afficher la carte piochée (face visible)
    const carteDiv = afficherCarte(cartePiochee, -2, true);
    carteDiv.classList.add('carte-piochee');
    piocheeContainer.appendChild(carteDiv);
    
    // Boutons d'action
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'carte-piochee-actions';
    
    const btnEchanger = document.createElement('button');
    btnEchanger.className = 'btn btn-exchange';
    btnEchanger.textContent = '🔄 Échanger avec mon deck';
    btnEchanger.onclick = activerModeEchange;
    actionsDiv.appendChild(btnEchanger);
    
    // RÈGLE : On ne peut défausser QUE si la carte vient de la pioche
    if (sourceCartePiochee === 'pioche') {
        const btnDefausser = document.createElement('button');
        btnDefausser.className = 'btn btn-discard';
        btnDefausser.textContent = '🗑️ Défausser';
        btnDefausser.onclick = defausserCartePiochee;
        actionsDiv.appendChild(btnDefausser);
    }
    
    piocheeContainer.appendChild(actionsDiv);
    
    // Message selon la source
    if (sourceCartePiochee === 'defausse') {
        updateMessage(`Joueur ${joueurActif} : Vous DEVEZ échanger cette carte (impossible de défausser une carte prise de la défausse)`);
    } else {
        // Indiquer si la carte a un pouvoir
        const valeur = cartePiochee.valeur;
        let pouvoirMsg = '';
        if (['8', '9', '10'].includes(valeur)) {
            pouvoirMsg = ' | 👁️ Si vous défaussez : regardez une de vos cartes';
        } else if (valeur === 'Valet') {
            pouvoirMsg = ' | 🔀 Si vous défaussez : échangez 2 cartes (sans regarder)';
        } else if (valeur === 'Dame') {
            pouvoirMsg = ' | 👸 Si vous défaussez : regardez une carte adverse et échangez-la si vous voulez';
        }
        updateMessage(`Joueur ${joueurActif} : Échanger ou Défausser ?${pouvoirMsg}`);
    }
}

/**
 * Active le mode échange
 */
function activerModeEchange() {
    updateMessage(`Joueur ${joueurActif} : Cliquez sur une de VOS cartes pour l'échanger`);
    afficherPlateau();
}

/**
 * Échange la carte piochée avec une carte du deck
 */
function echangerCarte(index) {
    const main = getMainActive();
    const carteRemplacee = main[index];
    main[index] = cartePiochee;
    defausse.push(carteRemplacee);
    
    console.log(`🔄 J${joueurActif} échange : ${cartePiochee.valeur} remplace ${carteRemplacee.valeur}`);
    
    fermerCartePiochee();
    finirTour();
}

/**
 * Défausse la carte piochée et active le pouvoir si applicable
 */
function defausserCartePiochee() {
    defausse.push(cartePiochee);
    console.log(`🗑️ J${joueurActif} défausse : ${cartePiochee.valeur}`);
    
    const valeur = cartePiochee.valeur;
    
    fermerCartePiochee();
    
    // Vérifier et activer les pouvoirs spéciaux
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
 * Ferme le container de carte piochée
 */
function fermerCartePiochee() {
    document.getElementById('carte-piochee-container')?.remove();
    cartePiochee = null;
    enAttenteAction = false;
}

// ============================================
// EFFETS SPÉCIAUX DES CARTES
// ============================================

/**
 * Effet 8-9-10 : Regarder une de ses propres cartes
 */
function activerEffetRegard() {
    effetSpecialActif = { type: 'regard' };
    updateMessage(`✨ POUVOIR ACTIVÉ ! Joueur ${joueurActif} : Cliquez sur une de VOS cartes pour la regarder`);
    afficherPlateau();
}

function regarderCarte(index, joueur) {
    if (joueur !== joueurActif) return;
    
    const main = getMainActive();
    const carte = main[index];
    const carteDiv = document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`);
    
    // Animation de retournement
    carteDiv.classList.add('flipping');
    setTimeout(() => {
        carteDiv.className = `card card-front card-${carte.couleur}`;
        carteDiv.innerHTML = `
            <div class="card-value">${carte.valeur}</div>
            <div class="card-suit suit-${carte.couleur}">${getSymboleCouleur(carte.couleur)}</div>
            <div class="card-points">${carte.points} pts</div>
        `;
    }, 300);
    
    // Retourner après 3 secondes
    setTimeout(() => {
        carteDiv.classList.add('flipping');
        setTimeout(() => {
            effetSpecialActif = null;
            finirTour();
        }, 300);
    }, 3000);
    
    updateMessage(`Joueur ${joueurActif} : Mémorisez cette carte ! (${carte.points} pts)`);
}

/**
 * Effet Valet : Échanger 2 cartes SANS LES REGARDER
 */
function activerEffetValet() {
    effetSpecialActif = { type: 'valet', selection: [] };
    updateMessage(`🔀 POUVOIR VALET ! Joueur ${joueurActif} : Sélectionnez 2 cartes à échanger (les vôtres OU celles de l'adversaire) - SANS les regarder !`);
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
        // Sélectionner
        selection.push({ joueur, index, key });
        document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`).classList.add('selected');
    }
    
    if (selection.length === 2) {
        // Effectuer l'échange (SANS révéler les cartes)
        const [c1, c2] = selection;
        const main1 = c1.joueur === 1 ? mainJoueur1 : mainJoueur2;
        const main2 = c2.joueur === 1 ? mainJoueur1 : mainJoueur2;
        
        [main1[c1.index], main2[c2.index]] = [main2[c2.index], main1[c1.index]];
        
        console.log(`🔀 Valet : Échange J${c1.joueur}[${c1.index}] ↔ J${c2.joueur}[${c2.index}] (à l'aveugle)`);
        updateMessage(`Échange effectué ! Les cartes ont été échangées sans être révélées.`);
        
        effetSpecialActif = null;
        setTimeout(() => finirTour(), 1000);
    } else {
        updateMessage(`🔀 Sélectionnez encore ${2 - selection.length} carte(s) à échanger`);
    }
}

/**
 * Effet Dame : Regarder une carte adverse puis décider d'échanger ou non
 */
function activerEffetDame() {
    effetSpecialActif = { type: 'dame', etape: 1, carteAdverseIndex: null, carteAdverseJoueur: null };
    updateMessage(`👸 POUVOIR DAME ! Joueur ${joueurActif} : Cliquez sur une carte de l'ADVERSAIRE pour la regarder`);
    afficherPlateau();
}

function regarderCarteAdverseDame(index, joueur) {
    const mainAdverse = getMainAdverse();
    const carte = mainAdverse[index];
    const carteDiv = document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`);
    
    // Sauvegarder l'info
    effetSpecialActif.carteAdverseIndex = index;
    effetSpecialActif.carteAdverseJoueur = joueur;
    
    // Révéler la carte
    carteDiv.classList.add('flipping');
    setTimeout(() => {
        carteDiv.className = `card card-front card-${carte.couleur} revealed-dame`;
        carteDiv.innerHTML = `
            <div class="card-value">${carte.valeur}</div>
            <div class="card-suit suit-${carte.couleur}">${getSymboleCouleur(carte.couleur)}</div>
            <div class="card-points">${carte.points} pts</div>
        `;
        
        // Passer à l'étape 2 : choix d'échanger ou non
        effetSpecialActif.etape = 2;
        afficherChoixEchangeDame(carte);
    }, 300);
}

function afficherChoixEchangeDame(carteAdverse) {
    // Créer un overlay pour le choix
    const overlay = document.createElement('div');
    overlay.id = 'dame-choice-overlay';
    overlay.className = 'dame-choice-overlay';
    overlay.innerHTML = `
        <div class="dame-choice-content">
            <h3>👸 Carte adverse révélée : ${carteAdverse.valeur} (${carteAdverse.points} pts)</h3>
            <p>Voulez-vous échanger cette carte avec une des vôtres ?</p>
            <div class="dame-choice-buttons">
                <button class="btn btn-exchange" onclick="continuerEchangeDame()">✅ Oui, échanger</button>
                <button class="btn btn-secondary" onclick="annulerEchangeDame()">❌ Non, passer</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function continuerEchangeDame() {
    document.getElementById('dame-choice-overlay')?.remove();
    updateMessage(`Joueur ${joueurActif} : Cliquez sur une de VOS cartes pour l'échanger avec la carte adverse`);
    afficherPlateau();
}

function annulerEchangeDame() {
    document.getElementById('dame-choice-overlay')?.remove();
    effetSpecialActif = null;
    finirTour();
}

function echangerAvecAdverseDame(indexMaCarte) {
    const mainActive = getMainActive();
    const mainAdverse = getMainAdverse();
    const indexAdverse = effetSpecialActif.carteAdverseIndex;
    
    // Effectuer l'échange
    [mainActive[indexMaCarte], mainAdverse[indexAdverse]] = [mainAdverse[indexAdverse], mainActive[indexMaCarte]];
    
    console.log(`👸 Dame : Échange effectué !`);
    updateMessage(`Échange effectué !`);
    
    effetSpecialActif = null;
    setTimeout(() => finirTour(), 500);
}

// ============================================
// GESTION DES TOURS ET FIN DE PARTIE
// ============================================

/**
 * Termine le tour et passe au joueur suivant
 */
function finirTour() {
    if (dernierTour) {
        // Le joueur qui n'a PAS annoncé Cambio a fini son dernier tour
        revelerCartes();
        return;
    }
    
    afficherPlateau();
    afficherTransition(joueurActif === 1 ? 2 : 1);
}

/**
 * Affiche l'écran de transition entre les joueurs
 */
function afficherTransition(prochainJoueur, message = null) {
    const transition = document.getElementById('turn-transition');
    const title = document.getElementById('transition-title');
    const msg = document.getElementById('transition-message');
    
    title.textContent = `Au tour du Joueur ${prochainJoueur}`;
    msg.textContent = message || `Passez l'appareil au Joueur ${prochainJoueur}`;
    
    if (dernierTour) {
        msg.textContent = `⚠️ DERNIER TOUR ! Cambio a été annoncé. Passez l'appareil au Joueur ${prochainJoueur}`;
    }
    
    transition.style.display = 'flex';
}

/**
 * Commence le tour du nouveau joueur
 */
function commencerTour() {
    const transition = document.getElementById('turn-transition');
    transition.style.display = 'none';
    
    afficherPlateau();
    
    if (defausse.length > 0) {
        updateMessage(`Joueur ${joueurActif} : Piochez une carte (pioche ou défausse)`);
    } else {
        updateMessage(`Joueur ${joueurActif} : Piochez une carte de la pioche`);
    }
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
    
    document.getElementById('player1-score').textContent = `${score1} (${mainJoueur1.length} cartes)`;
    document.getElementById('player2-score').textContent = `${score2} (${mainJoueur2.length} cartes)`;
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
    
    updateMessage(`🎺 CAMBIO ! Joueur ${joueurActif} pense avoir le score le plus bas ! Dernier tour pour l'adversaire !`);
    document.getElementById('btn-cambio').style.display = 'none';
    
    // L'adversaire joue son dernier tour
    finirTour();
}

/**
 * PÉNALITÉ : Ajoute une carte au deck du joueur perdant
 */
function appliquerPenalite(joueur) {
    if (pioche.length === 0) {
        console.log("Pas de carte disponible pour la pénalité");
        return;
    }
    
    const cartePenalite = pioche.pop();
    const main = joueur === 1 ? mainJoueur1 : mainJoueur2;
    main.push(cartePenalite);
    
    console.log(`⚠️ PÉNALITÉ : Joueur ${joueur} reçoit une carte supplémentaire (${cartePenalite.valeur} de ${cartePenalite.couleur})`);
    return cartePenalite;
}

/**
 * Révèle toutes les cartes et détermine le gagnant
 */
function revelerCartes() {
    // Révéler toutes les cartes du Joueur 1
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
    
    // Révéler toutes les cartes du Joueur 2
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
    
    let message = `🎴 FIN DE MANCHE | Joueur 1 : ${score1} pts (${mainJoueur1.length} cartes) | Joueur 2 : ${score2} pts (${mainJoueur2.length} cartes)\n`;
    
    // Déterminer le gagnant et appliquer pénalité si nécessaire
    if (score1 < score2) {
        if (joueurCambio === 1) {
            message += `🏆 Joueur 1 GAGNE ! Cambio réussi !`;
        } else {
            message += `✅ Joueur 1 gagne, mais Joueur 2 a mal annoncé Cambio.`;
            // Pénalité potentielle ici
        }
    } else if (score2 < score1) {
        if (joueurCambio === 2) {
            message += `🏆 Joueur 2 GAGNE ! Cambio réussi !`;
        } else {
            message += `✅ Joueur 2 gagne, mais Joueur 1 a mal annoncé Cambio.`;
        }
    } else {
        // Égalité - celui qui a annoncé Cambio est pénalisé
        message += `🤝 ÉGALITÉ ! `;
        if (joueurCambio) {
            const cartePenalite = appliquerPenalite(joueurCambio);
            if (cartePenalite) {
                message += `Joueur ${joueurCambio} reçoit une carte de pénalité pour avoir annoncé Cambio sans avoir le meilleur score !`;
            }
        }
    }
    
    // Si celui qui a annoncé Cambio n'a pas le meilleur score, pénalité
    if (joueurCambio === 1 && score1 >= score2) {
        const cartePenalite = appliquerPenalite(1);
        if (cartePenalite) {
            message += ` ⚠️ PÉNALITÉ : Joueur 1 reçoit une carte supplémentaire !`;
        }
    } else if (joueurCambio === 2 && score2 >= score1) {
        const cartePenalite = appliquerPenalite(2);
        if (cartePenalite) {
            message += ` ⚠️ PÉNALITÉ : Joueur 2 reçoit une carte supplémentaire !`;
        }
    }
    
    updateMessage(message);
    console.log(message);
    
    // Rafraîchir l'affichage avec les cartes de pénalité
    afficherPlateau();
}

/**
 * Met à jour le message du jeu
 */
function updateMessage(message) {
    document.getElementById('game-message').textContent = message;
}

/**
 * Initialise une nouvelle partie
 */
function initialiserJeu() {
    console.clear();
    console.log('═══════════════════════════════════');
    console.log('  🎮 CAMBIO - 2 JOUEURS LOCAL    ');
    console.log('  Version avec règles corrigées   ');
    console.log('═══════════════════════════════════\n');
    
    // Réinitialiser tous les états
    phaseInitiale = true;
    joueurActif = 1;
    cartesVuesJ1 = [];
    cartesVuesJ2 = [];
    peekCountJ1 = 0;
    peekCountJ2 = 0;
    cartePiochee = null;
    sourceCartePiochee = null;
    enAttenteAction = false;
    effetSpecialActif = null;
    cambioAnnonce = false;
    joueurCambio = null;
    dernierTour = false;
    
    // Créer et distribuer
    deck = creerDeck();
    deck = melangerDeck(deck);
    distribuerCartes();
    afficherPlateau();
    
    updateMessage("Joueur 1 : Sélectionnez 2 de vos cartes à mémoriser");
    
    // Nettoyer l'interface
    document.getElementById('carte-piochee-container')?.remove();
    document.getElementById('dame-choice-overlay')?.remove();
    document.getElementById('btn-cambio').style.display = 'none';
    document.getElementById('turn-transition').style.display = 'none';
}

// ============================================
// INITIALISATION AU CHARGEMENT
// ============================================

window.addEventListener('DOMContentLoaded', () => {
    initialiserJeu();
    
    document.getElementById('btn-nouvelle-partie').addEventListener('click', () => {
        if (confirm('Commencer une nouvelle partie ?')) initialiserJeu();
    });
    
    document.getElementById('btn-cambio').addEventListener('click', annoncerCambio);
    
    document.getElementById('btn-start-turn').addEventListener('click', () => {
        joueurActif = joueurActif === 1 ? 2 : 1;
        commencerTour();
    });
});

// API de debug
window.cambio = {
    initialiserJeu,
    getMainJoueur1: () => mainJoueur1,
    getMainJoueur2: () => mainJoueur2,
    getPioche: () => pioche,
    getDefausse: () => defausse,
    getJoueurActif: () => joueurActif
};
