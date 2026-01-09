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
let partieTerminee = false; // NOUVEAU : Pour garder les cartes affichées

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
 * NOUVEAU : Pas de carte dans la défausse au début
 */
function distribuerCartes() {
    mainJoueur1 = [];
    mainJoueur2 = [];
    defausse = []; // Défausse vide au début
    pioche = [...deck];
    
    // 4 cartes pour chaque joueur
    for (let i = 0; i < 4; i++) {
        mainJoueur1.push(pioche.pop());
        mainJoueur2.push(pioche.pop());
    }
    
    // PAS de carte dans la défausse
    console.log(`🎴 Distribution : J1 = ${mainJoueur1.length}, J2 = ${mainJoueur2.length}, Pioche = ${pioche.length}, Défausse = ${defausse.length}`);
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
        // NOUVEAU : Si la partie est terminée, afficher les cartes face visible
        const faceVisible = partieTerminee;
        const carteDiv = afficherCarte(carte, index, faceVisible, joueur);
        
        // Si partie terminée, ne pas ajouter d'événements
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
        else if (fenetreDoublonActive) {
            carteDiv.classList.add('doublon-clickable');
            carteDiv.addEventListener('click', () => tenterDoublon(index, joueur));
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
        
        // NOUVEAU : Ne pas permettre de piocher si partie terminée
        if (!phaseInitiale && !enAttenteAction && !effetSpecialActif && !fenetreDoublonActive && !partieTerminee) {
            carteDefausse.classList.add('piochable');
            carteDefausse.addEventListener('click', piocherDefausse);
        }
        
        defausseDiv.appendChild(carteDefausse);
    } else {
        // Défausse vide : afficher un placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'card defausse-vide';
        placeholder.textContent = 'VIDE';
        placeholder.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:1.2em;color:#666;border:2px dashed #666;';
        defausseDiv.appendChild(placeholder);
    }
    
    // Pioche
    const piocheDiv = document.getElementById('pioche');
    piocheDiv.innerHTML = '';
    if (pioche.length > 0) {
        const carteDos = document.createElement('div');
        carteDos.className = 'card card-back';
        carteDos.innerHTML = '<div class="card-pattern"></div>';
        
        // NOUVEAU : Ne pas permettre de piocher si partie terminée
        if (!phaseInitiale && !enAttenteAction && !effetSpecialActif && !fenetreDoublonActive && !partieTerminee) {
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
        setTimeout(() => {
            phaseInitiale = false;
            joueurActif = 1;
            afficherPlateau();
            updateMessage(`Joueur 1 : Piochez une carte pour commencer`);
            document.getElementById('btn-cambio').style.display = 'inline-block';
        }, 3500);
    } else if (joueurActif === 1 && peekCountJ1 >= 2) {
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
    
    // NOUVEAU : Activer la fenêtre doublon après l'échange
    activerFenetreDoublon(carteRemplacee.valeur);
}

/**
 * Défausse la carte piochée
 */
function defausserCartePiochee() {
    defausse.push(cartePiochee);
    console.log(`🗑️ J${joueurActif} défausse : ${cartePiochee.valeur}`);
    
    const valeur = cartePiochee.valeur;
    const carteDefaussee = cartePiochee;
    
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
        // NOUVEAU : Activer la fenêtre doublon
        activerFenetreDoublon(carteDefaussee.valeur);
    }
}

/**
 * NOUVEAU : Active la fenêtre doublon (3 secondes)
 */
function activerFenetreDoublon(valeur) {
    // SÉCURITÉ : Ne pas activer si pas de valeur ou si partie terminée
    if (!valeur || partieTerminee) {
        finirTour();
        return;
    }
    
    console.log(`⚡ Activation fenêtre doublon pour : ${valeur}`);
    
    fenetreDoublonActive = true;
    valeurDoublon = valeur;
    
    updateMessage(`⚡ DOUBLON ! Si vous avez un ${valeur}, cliquez sur votre carte (3 secondes) !`);
    afficherPlateau();
    
    // CORRECTION : S'assurer que l'ancien countdown est supprimé
    const oldCountdown = document.getElementById('doublon-countdown');
    if (oldCountdown) {
        oldCountdown.remove();
    }
    
    // Timer de 3 secondes avec bouton Passer
    let countdown = 3;
    const countdownDiv = document.createElement('div');
    countdownDiv.id = 'doublon-countdown';
    countdownDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.95);color:white;padding:40px 60px;border-radius:20px;font-size:4em;font-weight:bold;z-index:9999;box-shadow:0 10px 50px rgba(0,0,0,0.8);text-align:center;';
    countdownDiv.innerHTML = `
        <div style="font-size:4em;margin-bottom:20px;color:#ff4444;">${countdown}</div>
        <div style="font-size:0.5em;margin-bottom:15px;">Carte défaussée: ${valeur}</div>
        <button id="btn-passer-doublon" style="font-size:0.4em;padding:10px 30px;background:#666;color:white;border:none;border-radius:10px;cursor:pointer;margin-top:10px;">Passer</button>
    `;
    document.body.appendChild(countdownDiv);
    
    // Bouton passer
    document.getElementById('btn-passer-doublon').addEventListener('click', () => {
        console.log('👆 Utilisateur a cliqué sur Passer');
        clearInterval(countdownInterval);
        fermerFenetreDoublon();
    });
    
    const countdownInterval = setInterval(() => {
        countdown--;
        const countdownDisplay = countdownDiv.querySelector('div');
        if (countdownDisplay) {
            countdownDisplay.textContent = countdown;
        }
        if (countdown <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
    
    // CORRECTION : S'assurer que le timer précédent est annulé
    if (timerDoublon) {
        clearTimeout(timerDoublon);
    }
    
    timerDoublon = setTimeout(() => {
        console.log('⏰ Timer doublon terminé automatiquement');
        clearInterval(countdownInterval);
        fermerFenetreDoublon();
    }, 3000);
}

/**
 * NOUVEAU : Tente de poser un doublon
 */
function tenterDoublon(index, joueur) {
    if (!fenetreDoublonActive) return;
    
    // NOUVEAU : Si CAMBIO a été annoncé, seul l'adversaire peut poser des doublons
    if (cambioAnnonce && joueur === joueurCambio) {
        updateMessage(`❌ Joueur ${joueur} : Vous avez annoncé CAMBIO, vous ne pouvez plus rien faire !`);
        return;
    }
    
    const main = joueur === 1 ? mainJoueur1 : mainJoueur2;
    const carte = main[index];
    
    // Vérifier si c'est la bonne valeur
    if (carte.valeur === valeurDoublon) {
        // SUCCÈS : Poser la carte
        console.log(`✅ J${joueur} pose un doublon ${carte.valeur} !`);
        defausse.push(carte);
        main.splice(index, 1); // Retirer la carte de la main
        
        updateMessage(`✅ Joueur ${joueur} a posé un ${carte.valeur} ! (${main.length} cartes restantes)`);
        
        // Continuer la fenêtre doublon pour les autres
        // (ne pas fermer immédiatement)
    } else {
        // ERREUR : Pénalité +1 carte
        console.log(`❌ J${joueur} ERREUR ! Attendait ${valeurDoublon} mais avait ${carte.valeur}`);
        
        if (pioche.length > 0) {
            const cartePenalite = pioche.pop();
            main.push(cartePenalite);
            updateMessage(`❌ Joueur ${joueur} : ERREUR ! Pénalité : +1 carte (maintenant ${main.length} cartes)`);
            console.log(`💥 Pénalité : J${joueur} pioche ${cartePenalite.valeur}`);
        }
        
        // Révéler la carte erronnée pendant 2 secondes
        const carteDiv = document.querySelector(`[data-joueur="${joueur}"][data-index="${index}"]`);
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

/**
 * NOUVEAU : Ferme la fenêtre doublon
 */
function fermerFenetreDoublon() {
    console.log('🔒 Fermeture de la fenêtre doublon');
    
    fenetreDoublonActive = false;
    valeurDoublon = null;
    
    if (timerDoublon) {
        clearTimeout(timerDoublon);
        timerDoublon = null;
    }
    
    // Supprimer le countdown
    const countdown = document.getElementById('doublon-countdown');
    if (countdown) {
        countdown.remove();
    }
    
    afficherPlateau();
    
    // Continuer le jeu normalement
    finirTour();
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
            
            // NOUVEAU : Vérifier si on peut activer doublon après l'effet
            if (defausse.length > 0) {
                activerFenetreDoublon(defausse[defausse.length - 1].valeur);
            } else {
                finirTour();
            }
        }, 300);
    }, 3000);
}

/**
 * Effet Valet : Échanger 2 cartes SANS LES REGARDER
 */
function activerEffetValet() {
    effetSpecialActif = { type: 'valet', selection: [] };
    updateMessage(`🃏 Joueur ${joueurActif} : Sélectionnez 2 cartes à échanger SANS LES REGARDER`);
    afficherPlateau();
}

function selectionnerPourValet(index, joueur) {
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
        
        // NOUVEAU : Activer doublon après Valet
        if (defausse.length > 0) {
            setTimeout(() => activerFenetreDoublon(defausse[defausse.length - 1].valeur), 500);
        } else {
            setTimeout(() => finirTour(), 500);
        }
    } else {
        updateMessage(`🃏 Sélectionnez encore ${2 - selection.length} carte(s)`);
    }
}

/**
 * Effet Dame : Regarder et échanger une carte
 */
function activerEffetDame() {
    effetSpecialActif = { type: 'dame', etape: 1, carteAdverseIndex: null, carteAdverseInfos: null };
    updateMessage(`👸 Joueur ${joueurActif} : Cliquez sur une carte de l'adversaire`);
    afficherPlateau();
}

function regarderEtEchangerDame(index, joueur) {
    if (!effetSpecialActif || effetSpecialActif.type !== 'dame') return;
    
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
                
                // NOUVEAU : Activer doublon après Dame
                if (defausse.length > 0) {
                    activerFenetreDoublon(defausse[defausse.length - 1].valeur);
                } else {
                    finirTour();
                }
            }, 2000);
        }, 300);
    }
}

/**
 * Termine le tour et passe au joueur suivant
 */
function finirTour() {
    // Si CAMBIO a été annoncé et que c'est le tour de l'adversaire qui vient de se terminer
    if (cambioAnnonce && joueurActif !== joueurCambio) {
        // L'adversaire a terminé son dernier tour → Révéler
        revelerCartes();
        return;
    }
    
    // Sinon, passer au joueur suivant normalement
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
    
    // Si CAMBIO a été annoncé et que c'est le tour de l'adversaire
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
    
    afficherPlateau();
    
    // Message adapté si c'est le dernier tour
    if (cambioAnnonce && joueurActif !== joueurCambio) {
        updateMessage(`⚠️ DERNIER TOUR ! Joueur ${joueurActif} : Piochez une carte`);
    } else {
        updateMessage(`Joueur ${joueurActif} : Piochez une carte`);
    }
}

/**
 * Met à jour les indicateurs de tour
 */
function mettreAJourIndicateursTour() {
    // NOUVEAU : Ne pas mettre à jour si la partie est terminée
    if (partieTerminee) return;
    
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
    
    updateMessage(`🎺 Joueur ${joueurActif} annonce CAMBIO ! L'adversaire a un dernier tour !`);
    document.getElementById('btn-cambio').style.display = 'none';
    
    console.log(`🎺 CAMBIO annoncé par J${joueurActif}. Dernier tour pour J${joueurActif === 1 ? 2 : 1}`);
    
    // Terminer le tour normalement et passer à l'adversaire
    finirTour();
}

/**
 * Révèle toutes les cartes
 */
function revelerCartes() {
    partieTerminee = true; // NOUVEAU : Marquer la partie comme terminée
    
    // NOUVEAU : Cacher le bouton CAMBIO
    document.getElementById('btn-cambio').style.display = 'none';
    
    // Calculer les scores
    const score1 = mainJoueur1.reduce((t, c) => t + c.points, 0);
    const score2 = mainJoueur2.reduce((t, c) => t + c.points, 0);
    
    // NOUVEAU : Afficher les scores à côté des noms
    const titre1 = document.querySelector('.player-section.current-player h2');
    const titre2 = document.querySelector('.player-section.opponent h2');
    
    titre1.innerHTML = `Joueur 1 : ${score1} points`;
    titre2.innerHTML = `Joueur 2 : ${score2} points`;
    
    // Afficher les cartes face visible
    afficherPlateau();
    
    // Déterminer le gagnant
    let message = `🏁 FIN DE PARTIE ! `;
    
    if (score1 < score2) {
        message += joueurCambio === 1 ? '🏆 Joueur 1 GAGNE avec CAMBIO !' : '🏆 Joueur 1 GAGNE (Joueur 2 a perdu le pari CAMBIO) !';
    } else if (score2 < score1) {
        message += joueurCambio === 2 ? '🏆 Joueur 2 GAGNE avec CAMBIO !' : '🏆 Joueur 2 GAGNE (Joueur 1 a perdu le pari CAMBIO) !';
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
    partieTerminee = false; // NOUVEAU : Réinitialiser
    fenetreDoublonActive = false;
    valeurDoublon = null;
    
    deck = creerDeck();
    deck = melangerDeck(deck);
    distribuerCartes();
    afficherPlateau();
    
    // NOUVEAU : Restaurer les titres originaux
    const titre1 = document.querySelector('.player-section.current-player h2');
    const titre2 = document.querySelector('.player-section.opponent h2');
    titre1.innerHTML = 'Joueur 1 <span id="player1-indicator" class="turn-indicator active">← Votre tour</span>';
    titre2.innerHTML = 'Joueur 2 <span id="player2-indicator" class="turn-indicator"></span>';
    
    updateMessage("Joueur 1 : Sélectionnez 2 cartes à mémoriser");
    
    document.getElementById('carte-piochee-container')?.remove();
    document.getElementById('doublon-countdown')?.remove();
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