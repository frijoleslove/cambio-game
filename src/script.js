// ============================================
// CAMBIO - MULTIJOUEUR LOCAL (2 JOUEURS)
// VERSION OPTIMISÉE ET NETTOYÉE
// ============================================

// ============================================
// CONSTANTES
// ============================================
const COULEURS = ['coeur', 'carreau', 'trefle', 'pique'];
const VALEURS = ['As', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valet', 'Dame', 'Roi'];
const SYMBOLES = { 'coeur': '♥', 'carreau': '♦', 'pique': '♠', 'trefle': '♣', 'rouge': '🃏', 'noir': '🃏' };
const CARTES_REGARD = ['8', '9', '10'];
const DUREE_DOUBLON = 5000;  // 5 secondes
const DUREE_PEEK = 3000;     // 3 secondes pour voir une carte
const DUREE_ANIMATION = 300; // Animation flip

// ============================================
// ÉTAT DU JEU (regroupé)
// ============================================
const gameState = {
    deck: [],
    mainJoueur1: [],
    mainJoueur2: [],
    pioche: [],
    defausse: [],
    joueurActif: 1,
    phaseInitiale: true,
    partieTerminee: false,
    etatTour: 'WAITING_DRAW',
    
    // Phase initiale
    cartesVuesJ1: [],
    cartesVuesJ2: [],
    peekCountJ1: 0,
    peekCountJ2: 0,
    
    // Pioche en cours
    cartePiochee: null,
    effetSpecialActif: null,
    
    // Cambio
    cambioAnnonce: false,
    joueurCambio: null,
    
    // Doublons
    fenetreDoublonActive: false,
    valeurDoublon: null,
    timerDoublon: null
};

// Alias pour compatibilité (accès direct aux variables)
let deck, mainJoueur1, mainJoueur2, pioche, defausse, joueurActif, phaseInitiale;
let cartesVuesJ1, cartesVuesJ2, peekCountJ1, peekCountJ2;
let etatTour, cartePiochee, effetSpecialActif;
let cambioAnnonce, joueurCambio, partieTerminee;
let fenetreDoublonActive, valeurDoublon, timerDoublon;

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Calcule les points d'une carte
 */
function calculerPoints(valeur, couleur) {
    if (valeur === 'Joker') return 0;
    if (valeur === 'Roi') return couleur === 'coeur' ? -1 : 13;
    if (valeur === 'As') return 1;
    if (valeur === 'Valet') return 11;
    if (valeur === 'Dame') return 12;
    const num = parseInt(valeur);
    return isNaN(num) ? 0 : num;
}

/**
 * Retourne le symbole d'une couleur
 */
function getSymboleCouleur(couleur) {
    return SYMBOLES[couleur] || '';
}

/**
 * Retourne la main du joueur actif
 */
function getMainActive() {
    return joueurActif === 1 ? mainJoueur1 : mainJoueur2;
}

/**
 * Retourne la main de l'adversaire
 */
function getMainAdverse() {
    return joueurActif === 1 ? mainJoueur2 : mainJoueur1;
}

/**
 * Retourne la main d'un joueur spécifique
 */
function getMainJoueur(joueur) {
    return joueur === 1 ? mainJoueur1 : mainJoueur2;
}

/**
 * Sélectionne un élément de carte dans le DOM
 */
function getCarteElement(joueur, index) {
    return document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`);
}

/**
 * Met à jour le message affiché
 */
function updateMessage(message) {
    const el = document.getElementById('game-message');
    if (el) el.textContent = message;
}

/**
 * Annule le timer doublon s'il existe
 */
function annulerTimerDoublon() {
    if (timerDoublon) {
        clearTimeout(timerDoublon);
        timerDoublon = null;
    }
}

// ============================================
// CRÉATION DU DECK
// ============================================

/**
 * Crée un deck de 54 cartes (52 + 2 Jokers)
 */
function creerDeck() {
    const nouveauDeck = [];
    
    // Cartes normales
    for (const couleur of COULEURS) {
        for (const valeur of VALEURS) {
            nouveauDeck.push({
                valeur,
                couleur,
                points: calculerPoints(valeur, couleur),
                id: `${valeur}_${couleur}`
            });
        }
    }
    
    // Jokers
    nouveauDeck.push({ valeur: 'Joker', couleur: 'rouge', points: 0, id: 'Joker_rouge' });
    nouveauDeck.push({ valeur: 'Joker', couleur: 'noir', points: 0, id: 'Joker_noir' });
    
    return nouveauDeck;
}

/**
 * Mélange un deck (Fisher-Yates)
 */
function melangerDeck(deckAMelanger) {
    const deckMelange = [...deckAMelanger];
    for (let i = deckMelange.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckMelange[i], deckMelange[j]] = [deckMelange[j], deckMelange[i]];
    }
    return deckMelange;
}

/**
 * Distribue les cartes aux joueurs
 */
function distribuerCartes() {
    mainJoueur1 = [];
    mainJoueur2 = [];
    defausse = [];
    pioche = [...deck];
    
    for (let i = 0; i < 4; i++) {
        mainJoueur1.push(pioche.pop());
        mainJoueur2.push(pioche.pop());
    }
    
    console.log(`🃏 Joueur 1 :`, mainJoueur1.map(c => `${c.valeur} ${c.couleur}`).join(', '));
    console.log(`🃏 Joueur 2 :`, mainJoueur2.map(c => `${c.valeur} ${c.couleur}`).join(', '));
    console.log(`📦 Pioche : ${pioche.length} cartes`);
}

// ============================================
// AFFICHAGE DES CARTES
// ============================================

/**
 * Génère le HTML d'une carte face visible
 */
function genererHTMLCarteFace(carte) {
    if (carte.valeur === 'Joker') {
        const couleur = carte.couleur === 'rouge' ? '#e74c3c' : '#2c3e50';
        return `
            <div class="card-value" style="color: ${couleur};">★</div>
            <div class="card-suit" style="font-size: 2.5em;">🃏</div>
            <div class="card-points">${carte.points} pts</div>
        `;
    }
    return `
        <div class="card-value">${carte.valeur}</div>
        <div class="card-suit suit-${carte.couleur}">${getSymboleCouleur(carte.couleur)}</div>
        <div class="card-points">${carte.points} pts</div>
    `;
}

/**
 * Crée un élément carte
 */
function afficherCarte(carte, index, faceVisible = false, joueur = 1) {
    const carteDiv = document.createElement('div');
    carteDiv.className = 'card';
    carteDiv.dataset.index = index;
    carteDiv.dataset.joueur = joueur;
    
    if (faceVisible) {
        const classeJoker = carte.valeur === 'Joker' ? `card-joker-${carte.couleur}` : `card-${carte.couleur}`;
        carteDiv.classList.add('card-front', classeJoker);
        carteDiv.innerHTML = genererHTMLCarteFace(carte);
    } else {
        carteDiv.classList.add('card-back');
        carteDiv.innerHTML = '<div class="card-pattern"></div>';
    }
    
    return carteDiv;
}

/**
 * Retourne une carte visuellement (animation)
 */
function retournerCarteVisuellement(carteDiv, carte, versLeFace = true) {
    carteDiv.classList.add('flipping');
    
    setTimeout(() => {
        if (versLeFace) {
            carteDiv.className = `card card-front card-${carte.couleur}`;
            carteDiv.innerHTML = genererHTMLCarteFace(carte);
        } else {
            carteDiv.className = 'card card-back';
            carteDiv.innerHTML = '<div class="card-pattern"></div>';
        }
    }, DUREE_ANIMATION);
}

// ============================================
// AFFICHAGE DU PLATEAU
// ============================================

/**
 * Affiche le plateau complet
 */
function afficherPlateau() {
    afficherMainJoueur(1);
    afficherMainJoueur(2);
    afficherCentrale();
    calculerEtAfficherScores();
    mettreAJourIndicateursTour();
    
    console.log(`📊 État: ${etatTour} | Joueur: ${joueurActif}`);
}

/**
 * Affiche la main d'un joueur
 */
function afficherMainJoueur(joueur) {
    const handDiv = document.getElementById(joueur === 1 ? 'player-hand' : 'player2-hand');
    const main = getMainJoueur(joueur);
    const peekCount = joueur === 1 ? peekCountJ1 : peekCountJ2;
    
    handDiv.innerHTML = '';
    
    main.forEach((carte, index) => {
        const carteDiv = afficherCarte(carte, index, partieTerminee, joueur);
        
        if (!partieTerminee) {
            ajouterInteractionCarte(carteDiv, index, joueur, peekCount);
        }
        
        handDiv.appendChild(carteDiv);
    });
}

/**
 * Ajoute les interactions appropriées à une carte selon l'état du jeu
 */
function ajouterInteractionCarte(carteDiv, index, joueur, peekCount) {
    // Phase initiale : peek
    if (phaseInitiale && joueur === joueurActif && peekCount < 2) {
        carteDiv.classList.add('peekable');
        carteDiv.addEventListener('click', () => gererPeek(index, joueur));
        return;
    }
    
    // Phase doublon
    if (fenetreDoublonActive && etatTour === 'REACTION') {
        carteDiv.classList.add('doublon-clickable');
        carteDiv.addEventListener('click', () => tenterDoublon(index, joueur));
        return;
    }
    
    // Effets spéciaux
    if (effetSpecialActif && etatTour === 'SPECIAL_EFFECT') {
        ajouterInteractionEffetSpecial(carteDiv, index, joueur);
        return;
    }
    
    // Échange après pioche
    if (etatTour === 'CHOOSING_CARD' && cartePiochee && joueur === joueurActif) {
        carteDiv.classList.add('exchangeable');
        carteDiv.addEventListener('click', () => echangerCarte(index));
    }
}

/**
 * Ajoute les interactions pour les effets spéciaux
 */
function ajouterInteractionEffetSpecial(carteDiv, index, joueur) {
    const { type, etape } = effetSpecialActif;
    
    if (type === 'regard' && joueur === joueurActif) {
        carteDiv.classList.add('selectable');
        carteDiv.addEventListener('click', () => regarderCarte(index, joueur));
    }
    else if (type === 'valet') {
        carteDiv.classList.add('selectable');
        carteDiv.addEventListener('click', () => selectionnerPourValet(index, joueur));
    }
    else if (type === 'dame') {
        if (etape === 1 && joueur !== joueurActif) {
            carteDiv.classList.add('selectable');
            carteDiv.addEventListener('click', () => regarderEtEchangerDame(index, joueur));
        }
        else if (etape === 2 && joueur === joueurActif) {
            carteDiv.classList.add('selectable');
            carteDiv.addEventListener('click', () => regarderEtEchangerDame(index, joueur));
        }
    }
}

/**
 * Affiche la zone centrale (pioche/défausse)
 */
function afficherCentrale() {
    afficherDefausse();
    afficherPioche();
}

/**
 * Affiche la défausse
 */
function afficherDefausse() {
    const defausseDiv = document.getElementById('defausse');
    defausseDiv.innerHTML = '';
    
    if (defausse.length > 0) {
        defausseDiv.appendChild(afficherCarte(defausse[defausse.length - 1], -1, true));
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'card defausse-vide';
        placeholder.textContent = 'VIDE';
        placeholder.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:1.2em;color:#999;border:2px dashed #ccc;background:white;';
        defausseDiv.appendChild(placeholder);
    }
}

/**
 * Affiche la pioche
 */
function afficherPioche() {
    const piocheDiv = document.getElementById('pioche');
    piocheDiv.innerHTML = '';
    
    if (pioche.length === 0) return;
    
    const carteDos = document.createElement('div');
    carteDos.className = 'card card-back';
    carteDos.innerHTML = '<div class="card-pattern"></div>';
    
    const piocheCliquable = !phaseInitiale && etatTour === 'WAITING_DRAW' && !partieTerminee;
    
    if (piocheCliquable) {
        carteDos.classList.add('piochable');
        carteDos.addEventListener('click', piocherPioche);
    } else {
        carteDos.classList.add('disabled');
    }
    
    piocheDiv.appendChild(carteDos);
    
    const countSpan = document.createElement('span');
    countSpan.className = 'deck-count';
    countSpan.textContent = pioche.length;
    piocheDiv.appendChild(countSpan);
}

/**
 * Met à jour les indicateurs de tour
 */
function mettreAJourIndicateursTour() {
    if (partieTerminee) return;
    
    const ind1 = document.getElementById('player1-indicator');
    const ind2 = document.getElementById('player2-indicator');
    const handJ1 = document.getElementById('player-hand');
    const handJ2 = document.getElementById('player2-hand');
    
    const estJoueur1 = joueurActif === 1;
    
    if (ind1) {
        ind1.textContent = estJoueur1 ? '← Votre tour' : '';
        ind1.classList.toggle('active', estJoueur1);
    }
    if (ind2) {
        ind2.textContent = estJoueur1 ? '' : '← Votre tour';
        ind2.classList.toggle('active', !estJoueur1);
    }
    if (handJ1) handJ1.classList.toggle('active-turn', estJoueur1);
    if (handJ2) handJ2.classList.toggle('active-turn', !estJoueur1);
}

/**
 * Calcule et affiche les scores
 */
function calculerEtAfficherScores() {
    const score1 = mainJoueur1.reduce((t, c) => t + c.points, 0);
    const score2 = mainJoueur2.reduce((t, c) => t + c.points, 0);
    
    const el1 = document.getElementById('player1-score');
    const el2 = document.getElementById('player2-score');
    const elCurrent = document.getElementById('current-score');
    
    if (el1) el1.textContent = score1;
    if (el2) el2.textContent = score2;
    if (elCurrent) elCurrent.textContent = joueurActif === 1 ? score1 : score2;
    
    return { score1, score2 };
}

// ============================================
// PHASE INITIALE (PEEK)
// ============================================

/**
 * Gère le peek initial d'une carte
 */
function gererPeek(index, joueur) {
    if (!phaseInitiale) return;
    
    const cartesVues = joueur === 1 ? cartesVuesJ1 : cartesVuesJ2;
    let peekCount = joueur === 1 ? peekCountJ1 : peekCountJ2;
    
    if (peekCount >= 2 || cartesVues.includes(index)) return;
    
    const carteDiv = getCarteElement(joueur, index);
    const main = getMainJoueur(joueur);
    const carte = main[index];
    
    cartesVues.push(index);
    if (joueur === 1) peekCountJ1++; else peekCountJ2++;
    peekCount++;
    
    // Montrer la carte
    carteDiv.classList.add('peeked');
    retournerCarteVisuellement(carteDiv, carte, true);
    
    // Cacher après 3 secondes
    setTimeout(() => {
        retournerCarteVisuellement(carteDiv, carte, false);
        
        setTimeout(() => {
            if (peekCount >= 2) {
                changerJoueurInitial();
            }
        }, DUREE_ANIMATION);
    }, DUREE_PEEK);
    
    const restant = 2 - peekCount;
    updateMessage(`Joueur ${joueur} : Sélectionnez encore ${restant} carte(s)`);
}

/**
 * Change de joueur pendant la phase initiale
 */
function changerJoueurInitial() {
    const delai = DUREE_PEEK + 500;
    
    if (peekCountJ1 >= 2 && peekCountJ2 >= 2) {
        // Les deux joueurs ont vu leurs cartes → début de partie
        setTimeout(() => {
            phaseInitiale = false;
            joueurActif = 1;
            etatTour = 'WAITING_DRAW';
            
            console.log('═══════════════════════════════════');
            console.log('  🎮 DÉBUT DE LA PARTIE           ');
            console.log('═══════════════════════════════════');
            
            afficherPlateau();
            updateMessage(`Joueur 1 : Piochez une carte depuis la pioche`);
            document.getElementById('btn-cambio').style.display = 'inline-block';
        }, delai);
    } else if (joueurActif === 1 && peekCountJ1 >= 2) {
        // Joueur 1 a fini → passage au joueur 2
        setTimeout(() => {
            joueurActif = 2;
            afficherPlateau();
            updateMessage(`Joueur 2 : Sélectionnez 2 cartes à mémoriser`);
        }, delai);
    }
}

// ============================================
// PIOCHE ET ACTIONS
// ============================================

/**
 * Pioche une carte
 */
function piocherPioche() {
    if (etatTour !== 'WAITING_DRAW') {
        console.log(`❌ BLOQUÉ : Tentative de pioche en état ${etatTour}`);
        return;
    }
    
    if (pioche.length === 0) {
        updateMessage("La pioche est vide !");
        return;
    }
    
    cartePiochee = pioche.pop();
    etatTour = 'CARD_DRAWN';
    
    console.log(`🎴 J${joueurActif} pioche : ${cartePiochee.valeur} de ${cartePiochee.couleur}`);
    
    afficherCartePiochee();
    afficherPlateau();
}

/**
 * Affiche la carte piochée avec les options
 */
function afficherCartePiochee() {
    if (etatTour !== 'CARD_DRAWN') return;
    
    const centerArea = document.querySelector('.center-area');
    
    // Supprimer l'ancien container s'il existe
    document.getElementById('carte-piochee-container')?.remove();
    
    const container = document.createElement('div');
    container.id = 'carte-piochee-container';
    container.className = 'carte-piochee-container';
    
    const carteDiv = afficherCarte(cartePiochee, -2, true);
    carteDiv.classList.add('carte-piochee');
    container.appendChild(carteDiv);
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'carte-piochee-actions';
    actionsDiv.innerHTML = `
        <button class="btn btn-exchange" id="btn-echanger">🔄 Échanger avec une carte</button>
        <button class="btn btn-discard" id="btn-defausser">🗑️ Défausser cette carte</button>
    `;
    container.appendChild(actionsDiv);
    
    centerArea.appendChild(container);
    
    document.getElementById('btn-echanger').addEventListener('click', activerModeEchange);
    document.getElementById('btn-defausser').addEventListener('click', defausserCartePiochee);
    
    updateMessage(`Joueur ${joueurActif} : Choisissez une action - Échanger OU Défausser`);
}

/**
 * Active le mode échange
 */
function activerModeEchange() {
    if (etatTour !== 'CARD_DRAWN') return;
    
    etatTour = 'CHOOSING_CARD';
    updateMessage(`Joueur ${joueurActif} : Cliquez sur une de vos cartes pour l'échanger`);
    afficherPlateau();
}

/**
 * Échange la carte piochée avec une carte du joueur
 */
function echangerCarte(index) {
    if (etatTour !== 'CHOOSING_CARD') return;
    
    const container = document.getElementById('carte-piochee-container');
    
    // Animation de déplacement
    if (container) {
        const carteElement = container.querySelector('.carte-piochee');
        const targetCard = getCarteElement(joueurActif, index);
        
        if (carteElement && targetCard) {
            const targetRect = targetCard.getBoundingClientRect();
            const carteRect = carteElement.getBoundingClientRect();
            
            carteElement.style.transition = 'all 0.5s ease';
            carteElement.style.transform = `translate(${targetRect.left - carteRect.left}px, ${targetRect.top - carteRect.top}px) scale(0.8)`;
            carteElement.style.opacity = '0';
        }
    }
    
    setTimeout(() => {
        const main = getMainActive();
        const carteRemplacee = main[index];
        main[index] = cartePiochee;
        defausse.push(carteRemplacee);
        
        console.log(`🔄 J${joueurActif} échange : ${cartePiochee.valeur} ↔ ${carteRemplacee.valeur}`);
        
        document.getElementById('carte-piochee-container')?.remove();
        cartePiochee = null;
        
        etatTour = 'REACTION';
        activerFenetreDoublon(carteRemplacee.valeur);
    }, 500);
}

/**
 * Défausse la carte piochée
 */
function defausserCartePiochee() {
    if (etatTour !== 'CARD_DRAWN') return;
    
    const container = document.getElementById('carte-piochee-container');
    
    // Animation
    if (container) {
        const carteElement = container.querySelector('.carte-piochee');
        if (carteElement) {
            carteElement.style.transition = 'all 0.5s ease';
            carteElement.style.transform = 'translate(-200px, 100px) scale(0.8)';
            carteElement.style.opacity = '0';
        }
    }
    
    setTimeout(() => {
        const valeur = cartePiochee.valeur;
        defausse.push(cartePiochee);
        
        console.log(`🗑️ J${joueurActif} défausse : ${valeur}`);
        
        document.getElementById('carte-piochee-container')?.remove();
        cartePiochee = null;
        
        // Vérifier effets spéciaux
        if (CARTES_REGARD.includes(valeur)) {
            etatTour = 'SPECIAL_EFFECT';
            activerEffetRegard();
        } else if (valeur === 'Valet') {
            etatTour = 'SPECIAL_EFFECT';
            activerEffetValet();
        } else if (valeur === 'Dame') {
            etatTour = 'SPECIAL_EFFECT';
            activerEffetDame();
        } else {
            etatTour = 'REACTION';
            activerFenetreDoublon(valeur);
        }
    }, 500);
}

// ============================================
// PHASE DOUBLON (RÉACTION)
// ============================================

/**
 * Active la fenêtre doublon (5 secondes)
 */
function activerFenetreDoublon(valeur) {
    if (!valeur || partieTerminee) {
        passerAuJoueurSuivant();
        return;
    }
    
    console.log(`⚡ Activation fenêtre doublon pour : ${valeur} (5 secondes)`);
    
    fenetreDoublonActive = true;
    valeurDoublon = valeur;
    
    updateMessage(`💨 Doublons possibles ! Carte : ${valeur} - Soyez rapide (5 secondes)...`);
    document.getElementById('game-message')?.classList.add('doublon-actif');
    
    afficherPlateau();
    
    annulerTimerDoublon();
    timerDoublon = setTimeout(() => {
        console.log('⏰ Fenêtre doublon expirée');
        nettoyerPhaseReactionEtPasserTour();
    }, DUREE_DOUBLON);
}

/**
 * Tente de poser un doublon
 */
function tenterDoublon(index, joueur) {
    if (!fenetreDoublonActive || etatTour !== 'REACTION') return;
    
    // Joueur CAMBIO ne peut pas jouer
    if (cambioAnnonce && joueur === joueurCambio) {
        updateMessage(`❌ Joueur ${joueur} : Vous avez annoncé CAMBIO !`);
        return;
    }
    
    // Désactiver immédiatement
    fenetreDoublonActive = false;
    annulerTimerDoublon();
    
    const main = getMainJoueur(joueur);
    const carte = main[index];
    
    console.log(`🎯 J${joueur} tente de poser : ${carte.valeur} (attendu : ${valeurDoublon})`);
    
    if (carte.valeur === valeurDoublon) {
        gererDoublonReussi(index, joueur, main, carte);
    } else {
        gererDoublonEchoue(index, joueur, main, carte);
    }
}

/**
 * Gère un doublon réussi
 */
function gererDoublonReussi(index, joueur, main, carte) {
    const carteDiv = getCarteElement(joueur, index);
    
    if (carteDiv) {
        carteDiv.style.transition = 'all 0.3s ease';
        carteDiv.style.boxShadow = '0 0 40px rgba(0, 255, 0, 1)';
        carteDiv.style.transform = 'scale(1.2)';
        
        setTimeout(() => {
            carteDiv.style.transform = 'translateY(200px) scale(0.5)';
            carteDiv.style.opacity = '0';
        }, 200);
    }
    
    setTimeout(() => {
        console.log(`✅ J${joueur} pose un doublon ${carte.valeur} !`);
        defausse.push(carte);
        main.splice(index, 1);
        
        updateMessage(`✅ Joueur ${joueur} a posé un ${carte.valeur} ! (${main.length} cartes restantes)`);
        nettoyerPhaseReactionEtPasserTour();
    }, 500);
}

/**
 * Gère un doublon échoué (pénalité)
 */
function gererDoublonEchoue(index, joueur, main, carte) {
    console.log(`❌ J${joueur} ERREUR ! Attendait ${valeurDoublon} mais avait ${carte.valeur}`);
    
    // Pénalité : +1 carte
    if (pioche.length > 0) {
        const cartePenalite = pioche.pop();
        main.push(cartePenalite);
        console.log(`💥 Pénalité : J${joueur} reçoit ${cartePenalite.valeur}`);
    }
    
    updateMessage(`❌ Joueur ${joueur} : ERREUR ! C'était un ${carte.valeur}. Pénalité : +1 carte`);
    
    // Animation de révélation
    const carteDiv = getCarteElement(joueur, index);
    if (carteDiv) {
        carteDiv.style.transition = 'all 0.2s ease';
        carteDiv.style.boxShadow = '0 0 40px rgba(255, 0, 0, 1)';
        carteDiv.style.border = '3px solid red';
        
        retournerCarteVisuellement(carteDiv, carte, true);
        
        setTimeout(() => nettoyerPhaseReactionEtPasserTour(), 1800);
    } else {
        setTimeout(() => nettoyerPhaseReactionEtPasserTour(), 500);
    }
}

/**
 * Nettoie la phase de réaction et passe au tour suivant
 */
function nettoyerPhaseReactionEtPasserTour() {
    console.log('🔚 Fin de la phase de réaction');
    
    fenetreDoublonActive = false;
    valeurDoublon = null;
    annulerTimerDoublon();
    
    document.getElementById('game-message')?.classList.remove('doublon-actif');
    
    passerAuJoueurSuivant();
}

// ============================================
// EFFETS SPÉCIAUX
// ============================================

/**
 * Effet 8-9-10 : Regarder une de ses cartes
 */
function activerEffetRegard() {
    effetSpecialActif = { type: 'regard' };
    updateMessage(`✨ Joueur ${joueurActif} : Regardez une de vos cartes`);
    afficherPlateau();
}

function regarderCarte(index, joueur) {
    if (joueur !== joueurActif || etatTour !== 'SPECIAL_EFFECT') return;
    
    const main = getMainActive();
    const carte = main[index];
    const carteDiv = getCarteElement(joueur, index);
    
    retournerCarteVisuellement(carteDiv, carte, true);
    
    setTimeout(() => {
        retournerCarteVisuellement(carteDiv, carte, false);
        
        setTimeout(() => {
            effetSpecialActif = null;
            etatTour = 'REACTION';
            
            if (defausse.length > 0) {
                activerFenetreDoublon(defausse[defausse.length - 1].valeur);
            } else {
                passerAuJoueurSuivant();
            }
        }, DUREE_ANIMATION);
    }, DUREE_PEEK);
}

/**
 * Effet Valet : Échanger 2 cartes sans les regarder
 */
function activerEffetValet() {
    effetSpecialActif = { type: 'valet', selection: [] };
    updateMessage(`🃏 Joueur ${joueurActif} : Sélectionnez 2 cartes à échanger (sans les regarder)`);
    afficherPlateau();
}

function selectionnerPourValet(index, joueur) {
    if (etatTour !== 'SPECIAL_EFFECT') return;
    
    const selection = effetSpecialActif.selection;
    const key = `${joueur}-${index}`;
    
    const existingIndex = selection.findIndex(s => s.key === key);
    
    if (existingIndex >= 0) {
        // Désélectionner
        selection.splice(existingIndex, 1);
        getCarteElement(joueur, index)?.classList.remove('selected');
    } else if (selection.length < 2) {
        // Sélectionner
        selection.push({ joueur, index, key });
        getCarteElement(joueur, index)?.classList.add('selected');
    }
    
    if (selection.length === 2) {
        effectuerEchangeValet(selection);
    } else {
        updateMessage(`🃏 Sélectionnez encore ${2 - selection.length} carte(s)`);
    }
}

function effectuerEchangeValet(selection) {
    const [c1, c2] = selection;
    const main1 = getMainJoueur(c1.joueur);
    const main2 = getMainJoueur(c2.joueur);
    
    [main1[c1.index], main2[c2.index]] = [main2[c2.index], main1[c1.index]];
    
    console.log(`🃏 Valet : Échange J${c1.joueur}[${c1.index}] ↔ J${c2.joueur}[${c2.index}]`);
    
    effetSpecialActif = null;
    etatTour = 'REACTION';
    
    setTimeout(() => {
        if (defausse.length > 0) {
            activerFenetreDoublon(defausse[defausse.length - 1].valeur);
        } else {
            passerAuJoueurSuivant();
        }
    }, 500);
}

/**
 * Effet Dame : Regarder une carte adverse, puis choisir d'échanger ou non
 */
function activerEffetDame() {
    effetSpecialActif = { 
        type: 'dame', 
        etape: 1,
        carteAdverseIndex: null, 
        carteAdverseInfos: null 
    };
    updateMessage(`👸 Joueur ${joueurActif} : Cliquez sur une carte de l'adversaire pour la regarder`);
    afficherPlateau();
}

function afficherChoixDame() {
    document.getElementById('dame-choix-container')?.remove();
    
    const container = document.createElement('div');
    container.id = 'dame-choix-container';
    container.className = 'dame-choix-container';
    
    const { valeur, points } = effetSpecialActif.carteAdverseInfos;
    
    container.innerHTML = `
        <div class="dame-choix-content">
            <p>Carte adverse vue : <strong>${valeur}</strong> (${points} pts)</p>
            <p>Voulez-vous échanger avec une de vos cartes ?</p>
            <div class="dame-choix-buttons">
                <button id="btn-dame-oui" class="btn btn-exchange">✅ Oui, échanger</button>
                <button id="btn-dame-non" class="btn btn-discard">❌ Non, passer</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(container);
    
    document.getElementById('btn-dame-oui').addEventListener('click', () => {
        container.remove();
        effetSpecialActif.etape = 2;
        updateMessage(`👸 Joueur ${joueurActif} : Cliquez sur UNE de VOS cartes pour l'échanger (à l'aveugle)`);
        afficherPlateau();
    });
    
    document.getElementById('btn-dame-non').addEventListener('click', () => {
        container.remove();
        console.log(`👸 Dame : Joueur ${joueurActif} refuse l'échange`);
        
        effetSpecialActif = null;
        etatTour = 'REACTION';
        
        if (defausse.length > 0) {
            activerFenetreDoublon(defausse[defausse.length - 1].valeur);
        } else {
            passerAuJoueurSuivant();
        }
    });
}

function regarderEtEchangerDame(index, joueur) {
    if (!effetSpecialActif || effetSpecialActif.type !== 'dame' || etatTour !== 'SPECIAL_EFFECT') return;
    
    if (effetSpecialActif.etape === 1 && joueur !== joueurActif) {
        // Étape 1 : Regarder carte adverse
        const main = getMainAdverse();
        const carte = main[index];
        const carteDiv = getCarteElement(joueur, index);
        
        effetSpecialActif.carteAdverseIndex = index;
        effetSpecialActif.carteAdverseInfos = carte;
        
        retournerCarteVisuellement(carteDiv, carte, true);
        
        setTimeout(() => {
            retournerCarteVisuellement(carteDiv, carte, false);
            setTimeout(() => afficherChoixDame(), DUREE_ANIMATION);
        }, 2000);
    }
    else if (effetSpecialActif.etape === 2 && joueur === joueurActif) {
        // Étape 2 : Échanger à l'aveugle
        const main = getMainActive();
        const mainAdv = getMainAdverse();
        const carteAdvIndex = effetSpecialActif.carteAdverseIndex;
        
        [main[index], mainAdv[carteAdvIndex]] = [mainAdv[carteAdvIndex], main[index]];
        
        console.log(`👸 Dame : Échange effectué (à l'aveugle)`);
        updateMessage(`👸 Échange effectué !`);
        
        effetSpecialActif = null;
        
        setTimeout(() => {
            etatTour = 'REACTION';
            if (defausse.length > 0) {
                activerFenetreDoublon(defausse[defausse.length - 1].valeur);
            } else {
                passerAuJoueurSuivant();
            }
        }, 500);
    }
}

// ============================================
// GESTION DES TOURS
// ============================================

/**
 * Passe au joueur suivant
 */
function passerAuJoueurSuivant() {
    // Vérifier fin de partie (CAMBIO)
    if (cambioAnnonce && joueurActif !== joueurCambio) {
        revelerCartes();
        return;
    }
    
    joueurActif = joueurActif === 1 ? 2 : 1;
    etatTour = 'WAITING_DRAW';
    
    console.log(`\n═══════════════════════════════════`);
    console.log(`  🎮 TOUR DU JOUEUR ${joueurActif}`);
    console.log(`═══════════════════════════════════`);
    
    afficherPlateau();
    
    const message = cambioAnnonce && joueurActif !== joueurCambio
        ? `⚠️ DERNIER TOUR ! Joueur ${joueurActif} : Piochez une carte`
        : `Joueur ${joueurActif} : Piochez une carte depuis la pioche`;
    
    updateMessage(message);
}

// ============================================
// CAMBIO ET FIN DE PARTIE
// ============================================

/**
 * Annonce Cambio
 */
function annoncerCambio() {
    if (cambioAnnonce) return;
    
    cambioAnnonce = true;
    joueurCambio = joueurActif;
    
    updateMessage(`🎺 Joueur ${joueurActif} annonce CAMBIO ! L'adversaire a un dernier tour !`);
    document.getElementById('btn-cambio').style.display = 'none';
    
    console.log(`🎺 CAMBIO annoncé par J${joueurActif}`);
    
    passerAuJoueurSuivant();
}

/**
 * Révèle toutes les cartes et termine la partie
 */
function revelerCartes() {
    partieTerminee = true;
    
    document.getElementById('btn-cambio').style.display = 'none';
    
    const { score1, score2 } = calculerEtAfficherScores();
    
    const titre1 = document.querySelector('.player-section.current-player h2');
    const titre2 = document.querySelector('.player-section.opponent h2');
    
    if (titre1) titre1.innerHTML = `Joueur 1 : ${score1} points`;
    if (titre2) titre2.innerHTML = `Joueur 2 : ${score2} points`;
    
    afficherPlateau();
    
    let message = `🏁 FIN DE PARTIE ! `;
    
    if (score1 < score2) {
        message += joueurCambio === 1 ? '🏆 Joueur 1 GAGNE avec CAMBIO !' : '🏆 Joueur 1 GAGNE !';
    } else if (score2 < score1) {
        message += joueurCambio === 2 ? '🏆 Joueur 2 GAGNE avec CAMBIO !' : '🏆 Joueur 2 GAGNE !';
    } else {
        message += '🤝 ÉGALITÉ !';
    }
    
    updateMessage(message);
    console.log(message);
}

// ============================================
// INITIALISATION
// ============================================

/**
 * Initialise une nouvelle partie
 */
function initialiserJeu() {
    console.clear();
    console.log('═══════════════════════════════════════════');
    console.log('  🎮 CAMBIO - VERSION OPTIMISÉE           ');
    console.log('═══════════════════════════════════════════\n');
    
    // Réinitialiser l'état
    phaseInitiale = true;
    joueurActif = 1;
    cartesVuesJ1 = [];
    cartesVuesJ2 = [];
    peekCountJ1 = 0;
    peekCountJ2 = 0;
    cartePiochee = null;
    effetSpecialActif = null;
    cambioAnnonce = false;
    joueurCambio = null;
    partieTerminee = false;
    fenetreDoublonActive = false;
    valeurDoublon = null;
    etatTour = 'WAITING_DRAW';
    
    annulerTimerDoublon();
    
    // Créer et distribuer
    deck = creerDeck();
    deck = melangerDeck(deck);
    distribuerCartes();
    
    // Afficher
    afficherPlateau();
    
    // Réinitialiser les titres
    const titre1 = document.querySelector('.player-section.current-player h2');
    const titre2 = document.querySelector('.player-section.opponent h2');
    if (titre1) titre1.innerHTML = 'Joueur 1 <span id="player1-indicator" class="turn-indicator active">← Votre tour</span>';
    if (titre2) titre2.innerHTML = 'Joueur 2 <span id="player2-indicator" class="turn-indicator"></span>';
    
    updateMessage("Joueur 1 : Sélectionnez 2 cartes à mémoriser");
    
    // Nettoyer l'UI
    document.getElementById('carte-piochee-container')?.remove();
    document.getElementById('dame-choix-container')?.remove();
    document.getElementById('btn-cambio').style.display = 'none';
    document.getElementById('turn-transition').style.display = 'none';
}

// ============================================
// EVENT LISTENERS
// ============================================

window.addEventListener('DOMContentLoaded', () => {
    initialiserJeu();
    
    document.getElementById('btn-nouvelle-partie')?.addEventListener('click', initialiserJeu);
    document.getElementById('btn-cambio')?.addEventListener('click', annoncerCambio);
});

// API pour debug
window.cambio = {
    initialiserJeu,
    getEtat: () => ({ etatTour, joueurActif, fenetreDoublonActive }),
    getMainJoueur1: () => mainJoueur1,
    getMainJoueur2: () => mainJoueur2,
    getPioche: () => pioche,
    getDefausse: () => defausse
};