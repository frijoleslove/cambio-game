# cambio-game
// ============================================
// CAMBIO - MULTIJOUEUR LOCAL (2 JOUEURS)
// VERSION CORRIGÉE - RÈGLES STRICTES
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

// ============================================
// MACHINE À ÉTATS DU TOUR (CORRIGÉE)
// ============================================
// WAITING_DRAW    : Début du tour, SEULE la pioche est cliquable
// CARD_DRAWN      : Carte piochée affichée, choix Échanger/Défausser
// CHOOSING_CARD   : Mode échange actif, joueur clique sur sa carte
// SPECIAL_EFFECT  : Effet spécial en cours (8-9-10, Valet, Dame)
// REACTION        : Phase doublon active (2 secondes)
// ============================================
let etatTour = 'WAITING_DRAW';

// État de la pioche en cours
let cartePiochee = null;
let enAttenteAction = false;
let effetSpecialActif = null;

// État du Cambio
let cambioAnnonce = false;
let joueurCambio = null;
let partieTerminee = false;

// État des doublons
let fenetreDoublonActive = false;
let valeurDoublon = null;
let timerDoublon = null;

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
    
    for (let i = 0; i < 4; i++) {
        mainJoueur1.push(pioche.pop());
        mainJoueur2.push(pioche.pop());
    }
    
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
    
    // DEBUG : Afficher l'état actuel
    console.log(`📊 État actuel : ${etatTour} | Joueur actif : ${joueurActif}`);
}

/**
 * Affiche la main d'un joueur
 */
function afficherMainJoueur(joueur) {
    const handDiv = joueur === 1 ? document.getElementById('player-hand') : document.getElementById('player2-hand');
    const main = joueur === 1 ? mainJoueur1 : mainJoueur2;
    const peekCount = joueur === 1 ? peekCountJ1 : peekCountJ2;
    
    handDiv.innerHTML = '';
    
    main.forEach((carte, index) => {
        const faceVisible = partieTerminee;
        const carteDiv = afficherCarte(carte, index, faceVisible, joueur);
        
        if (partieTerminee) {
            handDiv.appendChild(carteDiv);
            return;
        }
        
        // Phase initiale : peek pour le joueur actif
        if (phaseInitiale && joueur === joueurActif && peekCount < 2) {
            carteDiv.classList.add('peekable');
            carteDiv.addEventListener('click', () => gererPeek(index, joueur));
        }
        // Fenêtre doublon active : tous les joueurs peuvent cliquer
        else if (fenetreDoublonActive && etatTour === 'REACTION') {
            carteDiv.classList.add('doublon-clickable');
            carteDiv.addEventListener('click', () => tenterDoublon(index, joueur));
        }
        // Effets spéciaux
        else if (effetSpecialActif && etatTour === 'SPECIAL_EFFECT') {
            if (effetSpecialActif.type === 'regard' && joueur === joueurActif) {
                carteDiv.classList.add('selectable');
                carteDiv.addEventListener('click', () => regarderCarte(index, joueur));
            }
            else if (effetSpecialActif.type === 'valet') {
                carteDiv.classList.add('selectable');
                carteDiv.addEventListener('click', () => selectionnerPourValet(index, joueur));
            }
            else if (effetSpecialActif.type === 'dame') {
                if (effetSpecialActif.etape === 1 && joueur !== joueurActif) {
                    carteDiv.classList.add('selectable');
                    carteDiv.addEventListener('click', () => regarderEtEchangerDame(index, joueur));
                }
                else if (effetSpecialActif.etape === 2 && joueur === joueurActif) {
                    carteDiv.classList.add('selectable');
                    carteDiv.addEventListener('click', () => regarderEtEchangerDame(index, joueur));
                }
            }
        }
        // ÉTAT CHOOSING_CARD : Échange après pioche
        else if (etatTour === 'CHOOSING_CARD' && cartePiochee && joueur === joueurActif) {
            carteDiv.classList.add('exchangeable');
            carteDiv.addEventListener('click', () => echangerCarte(index));
        }
        
        handDiv.appendChild(carteDiv);
    });
}

/**
 * Affiche la zone centrale (pioche/défausse)
 * CORRIGÉ : Contrôle strict selon l'état du tour
 */
function afficherCentrale() {
    // ============================================
    // DÉFAUSSE - JAMAIS CLIQUABLE POUR PIOCHER
    // ============================================
    const defausseDiv = document.getElementById('defausse');
    defausseDiv.innerHTML = '';
    
    if (defausse.length > 0) {
        const carteDefausse = afficherCarte(defausse[defausse.length - 1], -1, true);
        // ❌ PAS D'ÉVÉNEMENT CLICK - La défausse n'est JAMAIS une source de pioche
        // Elle sert uniquement à recevoir les cartes défaussées
        defausseDiv.appendChild(carteDefausse);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'card defausse-vide';
        placeholder.textContent = 'VIDE';
        placeholder.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:1.2em;color:#999;border:2px dashed #ccc;background:white;';
        defausseDiv.appendChild(placeholder);
    }
    
    // ============================================
    // PIOCHE - CLIQUABLE UNIQUEMENT EN WAITING_DRAW
    // ============================================
    const piocheDiv = document.getElementById('pioche');
    piocheDiv.innerHTML = '';
    
    if (pioche.length > 0) {
        const carteDos = document.createElement('div');
        carteDos.className = 'card card-back';
        carteDos.innerHTML = '<div class="card-pattern"></div>';
        
        // ✅ La pioche n'est cliquable QUE si :
        // - Pas en phase initiale
        // - État = WAITING_DRAW (et UNIQUEMENT cet état)
        // - Partie pas terminée
        const piocheCliquable = !phaseInitiale && 
                               etatTour === 'WAITING_DRAW' && 
                               !partieTerminee;
        
        if (piocheCliquable) {
            carteDos.classList.add('piochable');
            carteDos.addEventListener('click', piocherPioche);
            console.log('✅ Pioche ACTIVÉE (état: WAITING_DRAW)');
        } else {
            carteDos.classList.add('disabled');
            console.log(`🔒 Pioche DÉSACTIVÉE (état: ${etatTour})`);
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
 * MODIFIÉ : Changement direct sans popup
 */
function changerJoueurInitial() {
    if (peekCountJ1 >= 2 && peekCountJ2 >= 2) {
        setTimeout(() => {
            phaseInitiale = false;
            joueurActif = 1;
            etatTour = 'WAITING_DRAW';
            
            console.log('═══════════════════════════════════');
            console.log('  🎮 DÉBUT DE LA PARTIE           ');
            console.log('  État initial : WAITING_DRAW     ');
            console.log('═══════════════════════════════════');
            
            afficherPlateau();
            updateMessage(`Joueur 1 : Piochez une carte depuis la pioche`);
            document.getElementById('btn-cambio').style.display = 'inline-block';
        }, 3500);
    } else if (joueurActif === 1 && peekCountJ1 >= 2) {
        // Changement direct vers joueur 2 (sans popup)
        setTimeout(() => {
            joueurActif = 2;
            afficherPlateau();
            updateMessage(`Joueur 2 : Sélectionnez 2 cartes à mémoriser`);
        }, 3500);
    }
}

/**
 * Pioche dans la pioche
 * CORRIGÉ : Vérifie strictement l'état
 */
function piocherPioche() {
    // ✅ VÉRIFICATION STRICTE DE L'ÉTAT
    if (etatTour !== 'WAITING_DRAW') {
        console.log(`❌ BLOQUÉ : Tentative de pioche en état ${etatTour}`);
        return;
    }
    
    if (pioche.length === 0) {
        updateMessage("La pioche est vide !");
        return;
    }
    
    // Piocher la carte
    cartePiochee = pioche.pop();
    
    // TRANSITION D'ÉTAT : WAITING_DRAW → CARD_DRAWN
    etatTour = 'CARD_DRAWN';
    enAttenteAction = true;
    
    console.log(`🎴 J${joueurActif} pioche : ${cartePiochee.valeur} de ${cartePiochee.couleur}`);
    console.log(`📊 Transition : WAITING_DRAW → CARD_DRAWN`);
    
    afficherCartePiochee();
    afficherPlateau();
}

/**
 * Affiche la carte piochée avec les options
 */
function afficherCartePiochee() {
    // Vérifier qu'on est dans le bon état
    if (etatTour !== 'CARD_DRAWN') {
        console.log(`❌ Impossible d'afficher la carte piochée en état ${etatTour}`);
        return;
    }
    
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
    
    // Bouton Échanger
    const btnEchanger = document.createElement('button');
    btnEchanger.className = 'btn btn-exchange';
    btnEchanger.textContent = '🔄 Échanger avec une carte';
    btnEchanger.onclick = activerModeEchange;
    actionsDiv.appendChild(btnEchanger);
    
    // Bouton Défausser
    const btnDefausser = document.createElement('button');
    btnDefausser.className = 'btn btn-discard';
    btnDefausser.textContent = '🗑️ Défausser cette carte';
    btnDefausser.onclick = defausserCartePiochee;
    actionsDiv.appendChild(btnDefausser);
    
    piocheeContainer.appendChild(actionsDiv);
    
    updateMessage(`Joueur ${joueurActif} : Choisissez une action - Échanger OU Défausser`);
}

/**
 * Active le mode échange
 * TRANSITION : CARD_DRAWN → CHOOSING_CARD
 */
function activerModeEchange() {
    if (etatTour !== 'CARD_DRAWN') {
        console.log(`❌ Impossible d'activer l'échange en état ${etatTour}`);
        return;
    }
    
    // TRANSITION D'ÉTAT
    etatTour = 'CHOOSING_CARD';
    console.log(`📊 Transition : CARD_DRAWN → CHOOSING_CARD`);
    
    updateMessage(`Joueur ${joueurActif} : Cliquez sur une de vos cartes pour l'échanger`);
    afficherPlateau();
}

/**
 * Échange la carte piochée
 */
function echangerCarte(index) {
    if (etatTour !== 'CHOOSING_CARD') {
        console.log(`❌ Impossible d'échanger en état ${etatTour}`);
        return;
    }
    
    const piocheeContainer = document.getElementById('carte-piochee-container');
    
    // Animation
    if (piocheeContainer) {
        const carteElement = piocheeContainer.querySelector('.carte-piochee');
        const targetCard = document.querySelector(`[data-joueur="${joueurActif}"][data-index="${index}"]`);
        
        if (carteElement && targetCard) {
            const targetRect = targetCard.getBoundingClientRect();
            const carteRect = carteElement.getBoundingClientRect();
            
            const deltaX = targetRect.left - carteRect.left;
            const deltaY = targetRect.top - carteRect.top;
            
            carteElement.style.transition = 'all 0.5s ease';
            carteElement.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.8)`;
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
        enAttenteAction = false;
        
        // TRANSITION : CHOOSING_CARD → REACTION
        etatTour = 'REACTION';
        console.log(`📊 Transition : CHOOSING_CARD → REACTION`);
        
        activerFenetreDoublon(carteRemplacee.valeur);
    }, 500);
}

/**
 * Défausse la carte piochée
 */
function defausserCartePiochee() {
    if (etatTour !== 'CARD_DRAWN') {
        console.log(`❌ Impossible de défausser en état ${etatTour}`);
        return;
    }
    
    const piocheeContainer = document.getElementById('carte-piochee-container');
    
    // Animation
    if (piocheeContainer) {
        const carteElement = piocheeContainer.querySelector('.carte-piochee');
        if (carteElement) {
            carteElement.style.transition = 'all 0.5s ease';
            carteElement.style.transform = 'translate(-200px, 100px) scale(0.8)';
            carteElement.style.opacity = '0';
        }
    }
    
    setTimeout(() => {
        defausse.push(cartePiochee);
        console.log(`🗑️ J${joueurActif} défausse : ${cartePiochee.valeur}`);
        
        const valeur = cartePiochee.valeur;
        const carteDefaussee = cartePiochee;
        
        document.getElementById('carte-piochee-container')?.remove();
        cartePiochee = null;
        enAttenteAction = false;
        
        // Vérifier effets spéciaux
        if (['8', '9', '10'].includes(valeur)) {
            etatTour = 'SPECIAL_EFFECT';
            console.log(`📊 Transition : CARD_DRAWN → SPECIAL_EFFECT (regard)`);
            activerEffetRegard();
        } else if (valeur === 'Valet') {
            etatTour = 'SPECIAL_EFFECT';
            console.log(`📊 Transition : CARD_DRAWN → SPECIAL_EFFECT (valet)`);
            activerEffetValet();
        } else if (valeur === 'Dame') {
            etatTour = 'SPECIAL_EFFECT';
            console.log(`📊 Transition : CARD_DRAWN → SPECIAL_EFFECT (dame)`);
            activerEffetDame();
        } else {
            // Pas d'effet spécial → Phase de réaction
            etatTour = 'REACTION';
            console.log(`📊 Transition : CARD_DRAWN → REACTION`);
            activerFenetreDoublon(carteDefaussee.valeur);
        }
    }, 500);
}

/**
 * Active la fenêtre doublon (2 secondes, invisible)
 */
function activerFenetreDoublon(valeur) {
    if (!valeur || partieTerminee) {
        finirTour();
        return;
    }
    
    console.log(`⚡ Activation fenêtre doublon pour : ${valeur}`);
    
    fenetreDoublonActive = true;
    valeurDoublon = valeur;
    
    updateMessage(`💨 Doublons possibles ! Carte : ${valeur} - Soyez rapide (2 secondes)...`);
    document.getElementById('game-message').classList.add('doublon-actif');
    
    afficherPlateau();
    
    if (timerDoublon) {
        clearTimeout(timerDoublon);
    }
    
    timerDoublon = setTimeout(() => {
        console.log('⏰ Fenêtre doublon terminée');
        fermerFenetreDoublon();
    }, 2000);
}

/**
 * Tente de poser un doublon
 */
function tenterDoublon(index, joueur) {
    if (!fenetreDoublonActive || etatTour !== 'REACTION') return;
    
    if (cambioAnnonce && joueur === joueurCambio) {
        updateMessage(`❌ Joueur ${joueur} : Vous avez annoncé CAMBIO !`);
        return;
    }
    
    const main = joueur === 1 ? mainJoueur1 : mainJoueur2;
    const carte = main[index];
    
    if (carte.valeur === valeurDoublon) {
        // SUCCÈS
        const carteDiv = document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`);
        
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
            
            updateMessage(`✅ Joueur ${joueur} a posé un ${carte.valeur} ! (${main.length} cartes)`);
            afficherPlateau();
        }, 500);
        
    } else {
        // ERREUR - Pénalité
        console.log(`❌ J${joueur} ERREUR ! Attendait ${valeurDoublon} mais avait ${carte.valeur}`);
        
        if (pioche.length > 0) {
            const cartePenalite = pioche.pop();
            main.push(cartePenalite);
            updateMessage(`❌ Joueur ${joueur} : ERREUR ! Pénalité : +1 carte`);
        }
        
        const carteDiv = document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`);
        if (carteDiv) {
            carteDiv.style.transition = 'all 0.2s ease';
            carteDiv.style.boxShadow = '0 0 40px rgba(255, 0, 0, 1)';
            
            carteDiv.classList.add('flipping');
            setTimeout(() => {
                carteDiv.className = `card card-front card-${carte.couleur}`;
                carteDiv.style.border = '3px solid red';
                carteDiv.innerHTML = `
                    <div class="card-value">${carte.valeur}</div>
                    <div class="card-suit suit-${carte.couleur}">${getSymboleCouleur(carte.couleur)}</div>
                    <div class="card-points">${carte.points} pts</div>
                `;
                
                setTimeout(() => {
                    afficherPlateau();
                }, 2000);
            }, 300);
        }
    }
}

/**
 * Ferme la fenêtre doublon
 */
function fermerFenetreDoublon() {
    console.log('🔒 Fermeture de la fenêtre doublon');
    
    fenetreDoublonActive = false;
    valeurDoublon = null;
    
    document.getElementById('game-message').classList.remove('doublon-actif');
    
    if (timerDoublon) {
        clearTimeout(timerDoublon);
        timerDoublon = null;
    }
    
    // TRANSITION : REACTION → WAITING_DRAW (prochain tour)
    etatTour = 'WAITING_DRAW';
    console.log(`📊 Transition : REACTION → WAITING_DRAW`);
    
    afficherPlateau();
    
    if (!phaseInitiale && !partieTerminee) {
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
    if (joueur !== joueurActif || etatTour !== 'SPECIAL_EFFECT') return;
    
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
            
            etatTour = 'REACTION';
            console.log(`📊 Transition : SPECIAL_EFFECT → REACTION`);
            
            if (defausse.length > 0) {
                activerFenetreDoublon(defausse[defausse.length - 1].valeur);
            } else {
                etatTour = 'WAITING_DRAW';
                finirTour();
            }
        }, 300);
    }, 3000);
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
    
    const indexInSelection = selection.findIndex(s => s.key === key);
    if (indexInSelection >= 0) {
        selection.splice(indexInSelection, 1);
        document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`).classList.remove('selected');
    } else if (selection.length < 2) {
        selection.push({ joueur, index, key });
        document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`).classList.add('selected');
    }
    
    if (selection.length === 2) {
        const [c1, c2] = selection;
        const main1 = c1.joueur === 1 ? mainJoueur1 : mainJoueur2;
        const main2 = c2.joueur === 1 ? mainJoueur1 : mainJoueur2;
        
        [main1[c1.index], main2[c2.index]] = [main2[c2.index], main1[c1.index]];
        
        console.log(`🃏 Valet : Échange J${c1.joueur}[${c1.index}] ↔ J${c2.joueur}[${c2.index}]`);
        
        effetSpecialActif = null;
        
        etatTour = 'REACTION';
        console.log(`📊 Transition : SPECIAL_EFFECT → REACTION`);
        
        if (defausse.length > 0) {
            setTimeout(() => activerFenetreDoublon(defausse[defausse.length - 1].valeur), 500);
        } else {
            setTimeout(() => {
                etatTour = 'WAITING_DRAW';
                finirTour();
            }, 500);
        }
    } else {
        updateMessage(`🃏 Sélectionnez encore ${2 - selection.length} carte(s)`);
    }
}

/**
 * Effet Dame : Regarder et échanger une carte adverse
 */
function activerEffetDame() {
    effetSpecialActif = { type: 'dame', etape: 1, carteAdverseIndex: null, carteAdverseInfos: null };
    updateMessage(`👸 Joueur ${joueurActif} : Cliquez sur une carte de l'adversaire`);
    afficherPlateau();
}

function regarderEtEchangerDame(index, joueur) {
    if (!effetSpecialActif || effetSpecialActif.type !== 'dame' || etatTour !== 'SPECIAL_EFFECT') return;
    
    if (effetSpecialActif.etape === 1) {
        const main = getMainAdverse();
        const carte = main[index];
        const carteDiv = document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`);
        
        effetSpecialActif.carteAdverseIndex = index;
        effetSpecialActif.carteAdverseInfos = carte;
        
        carteDiv.classList.add('flipping');
        setTimeout(() => {
            carteDiv.className = `card card-front card-${carte.couleur}`;
            carteDiv.innerHTML = `
                <div class="card-value">${carte.valeur}</div>
                <div class="card-suit suit-${carte.couleur}">${getSymboleCouleur(carte.couleur)}</div>
                <div class="card-points">${carte.points} pts</div>
            `;
            
            setTimeout(() => {
                carteDiv.classList.add('flipping');
                setTimeout(() => {
                    carteDiv.className = 'card card-back';
                    carteDiv.innerHTML = '<div class="card-pattern"></div>';
                    
                    effetSpecialActif.etape = 2;
                    updateMessage(`👸 Carte adverse : ${carte.valeur} (${carte.points} pts). Choisissez UNE de VOS cartes`);
                    afficherPlateau();
                }, 300);
            }, 2000);
        }, 300);
    }
    else if (effetSpecialActif.etape === 2 && joueur === joueurActif) {
        const main = getMainActive();
        const maCarte = main[index];
        const carteDiv = document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`);
        
        effetSpecialActif.maCarteIndex = index;
        
        carteDiv.classList.add('flipping');
        setTimeout(() => {
            carteDiv.className = `card card-front card-${maCarte.couleur}`;
            carteDiv.innerHTML = `
                <div class="card-value">${maCarte.valeur}</div>
                <div class="card-suit suit-${maCarte.couleur}">${getSymboleCouleur(maCarte.couleur)}</div>
                <div class="card-points">${maCarte.points} pts</div>
            `;
            
            setTimeout(() => {
                const carteAdv = effetSpecialActif.carteAdverseInfos;
                const echanger = confirm(
                    `Votre carte : ${maCarte.valeur} (${maCarte.points} pts)\n` +
                    `Carte adverse : ${carteAdv.valeur} (${carteAdv.points} pts)\n\n` +
                    `Échanger ?`
                );
                
                if (echanger) {
                    const mainAdv = getMainAdverse();
                    [main[index], mainAdv[effetSpecialActif.carteAdverseIndex]] = 
                    [mainAdv[effetSpecialActif.carteAdverseIndex], main[index]];
                    console.log(`👸 Dame : Échange effectué`);
                }
                
                effetSpecialActif = null;
                
                etatTour = 'REACTION';
                console.log(`📊 Transition : SPECIAL_EFFECT → REACTION`);
                
                if (defausse.length > 0) {
                    activerFenetreDoublon(defausse[defausse.length - 1].valeur);
                } else {
                    etatTour = 'WAITING_DRAW';
                    finirTour();
                }
            }, 2000);
        }, 300);
    }
}

/**
 * Termine le tour et passe au joueur suivant
 * MODIFIÉ : Changement direct sans popup
 */
function finirTour() {
    if (cambioAnnonce && joueurActif !== joueurCambio) {
        revelerCartes();
        return;
    }
    
    // Changement direct de joueur (pas de popup)
    joueurActif = joueurActif === 1 ? 2 : 1;
    etatTour = 'WAITING_DRAW';
    
    console.log(`\n═══════════════════════════════════`);
    console.log(`  🎮 TOUR DU JOUEUR ${joueurActif}`);
    console.log(`  État : WAITING_DRAW`);
    console.log(`═══════════════════════════════════`);
    
    afficherPlateau();
    
    if (cambioAnnonce && joueurActif !== joueurCambio) {
        updateMessage(`⚠️ DERNIER TOUR ! Joueur ${joueurActif} : Piochez une carte`);
    } else {
        updateMessage(`Joueur ${joueurActif} : Piochez une carte depuis la pioche`);
    }
}

/**
 * Affiche l'écran de transition
 */
function afficherTransition(prochainJoueur, message = null) {
    const transition = document.getElementById('turn-transition');
    const title = document.getElementById('transition-title');
    const msg = document.getElementById('transition-message');
    
    title.textContent = `Au tour du Joueur ${prochainJoueur}`;
    
    if (cambioAnnonce && prochainJoueur !== joueurCambio) {
        msg.textContent = `⚠️ DERNIER TOUR ! Joueur ${joueurCambio} a annoncé CAMBIO !`;
    } else {
        msg.textContent = message || `Passez l'appareil au Joueur ${prochainJoueur}`;
    }
    
    transition.style.display = 'flex';
}

/**
 * Commence le tour du joueur
 */
function commencerTour() {
    const transition = document.getElementById('turn-transition');
    transition.style.display = 'none';
    
    // IMPORTANT : Réinitialiser l'état au début du tour
    etatTour = 'WAITING_DRAW';
    console.log(`\n═══════════════════════════════════`);
    console.log(`  🎮 TOUR DU JOUEUR ${joueurActif}`);
    console.log(`  État : WAITING_DRAW`);
    console.log(`═══════════════════════════════════`);
    
    afficherPlateau();
    
    if (cambioAnnonce && joueurActif !== joueurCambio) {
        updateMessage(`⚠️ DERNIER TOUR ! Joueur ${joueurActif} : Piochez une carte`);
    } else {
        updateMessage(`Joueur ${joueurActif} : Piochez une carte depuis la pioche`);
    }
}

/**
 * Met à jour les indicateurs de tour et la bordure lumineuse
 * MODIFIÉ : Ajout de la bordure blanche lumineuse sur le joueur actif
 */
function mettreAJourIndicateursTour() {
    if (partieTerminee) return;
    
    const ind1 = document.getElementById('player1-indicator');
    const ind2 = document.getElementById('player2-indicator');
    
    // Récupérer les sections des joueurs
    const sectionJ1 = document.querySelector('.player-section.current-player');
    const sectionJ2 = document.querySelector('.player-section.opponent');
    
    // Récupérer les mains des joueurs
    const handJ1 = document.getElementById('player-hand');
    const handJ2 = document.getElementById('player2-hand');
    
    if (joueurActif === 1) {
        // Indicateur texte
        ind1.textContent = '← Votre tour';
        ind1.classList.add('active');
        ind2.textContent = '';
        ind2.classList.remove('active');
        
        // Bordure lumineuse blanche
        handJ1.classList.add('active-turn');
        handJ2.classList.remove('active-turn');
    } else {
        // Indicateur texte
        ind1.textContent = '';
        ind1.classList.remove('active');
        ind2.textContent = '← Votre tour';
        ind2.classList.add('active');
        
        // Bordure lumineuse blanche
        handJ1.classList.remove('active-turn');
        handJ2.classList.add('active-turn');
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
    
    updateMessage(`🎺 Joueur ${joueurActif} annonce CAMBIO ! L'adversaire a un dernier tour !`);
    document.getElementById('btn-cambio').style.display = 'none';
    
    console.log(`🎺 CAMBIO annoncé par J${joueurActif}`);
    
    finirTour();
}

/**
 * Révèle toutes les cartes
 */
function revelerCartes() {
    partieTerminee = true;
    
    document.getElementById('btn-cambio').style.display = 'none';
    
    const score1 = mainJoueur1.reduce((t, c) => t + c.points, 0);
    const score2 = mainJoueur2.reduce((t, c) => t + c.points, 0);
    
    const titre1 = document.querySelector('.player-section.current-player h2');
    const titre2 = document.querySelector('.player-section.opponent h2');
    
    titre1.innerHTML = `Joueur 1 : ${score1} points`;
    titre2.innerHTML = `Joueur 2 : ${score2} points`;
    
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
    console.log('═══════════════════════════════════════════');
    console.log('  🎮 CAMBIO - VERSION CORRIGÉE            ');
    console.log('  Machine à états stricte                 ');
    console.log('═══════════════════════════════════════════\n');
    
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
    partieTerminee = false;
    fenetreDoublonActive = false;
    valeurDoublon = null;
    
    // IMPORTANT : Initialiser l'état du tour
    etatTour = 'WAITING_DRAW';
    
    deck = creerDeck();
    deck = melangerDeck(deck);
    distribuerCartes();
    afficherPlateau();
    
    const titre1 = document.querySelector('.player-section.current-player h2');
    const titre2 = document.querySelector('.player-section.opponent h2');
    titre1.innerHTML = 'Joueur 1 <span id="player1-indicator" class="turn-indicator active">← Votre tour</span>';
    titre2.innerHTML = 'Joueur 2 <span id="player2-indicator" class="turn-indicator"></span>';
    
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
        initialiserJeu();
    });
    
    document.getElementById('btn-cambio').addEventListener('click', annoncerCambio);
    
    document.getElementById('btn-start-turn').addEventListener('click', () => {
        joueurActif = joueurActif === 1 ? 2 : 1;
        commencerTour();
    });
});

window.cambio = {
    initialiserJeu,
    getEtatTour: () => etatTour,
    getMainJoueur1: () => mainJoueur1,
    getMainJoueur2: () => mainJoueur2,
    getPioche: () => pioche,
    getDefausse: () => defausse
};