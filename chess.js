// ------------------------- global variables -------------------

// To make the asscii string notation to matrix work easier
let _fileToX = { a:0, b:1, c:2, d:3, e:4, f:5, g:6, h:7 };  // _fileToX["c"] = 2
let _rankToY = { 1:0, 2:1, 3:2, 4:3, 5:4, 6:5, 7:6, 8:7 };  // _rankToY["5"] = 4
const _boardFiles ='abcdefgh';
const _boardRanks = '87654321';  // <div> position 0 is board rank 8
let _currentScore = 0;
let _positiveMove = false;
let _goodMoves = [];
let _showAvailSpaces = true;
let _squareSize = 60;

// JSON Object for _game
let _game = {
    source: "", // Where game was published
    title: "",
    subtitle: "",
    annotator: "",  // Author's name
    startingPosition: "",  //FEN format
    summary: "",
    opening: "",  // i.e. CARO-KANN DEFENSE (B13)"
    white: "", // name
    black: "", // name
    site: "", 
    moveCount: 0,
    steps : [],  // _move objects
    iStep: 0, // Index of current step
}

// Current step (set of moves)
let _step = {
    moves: [],
    iMove: 0,  //Needed for back/forward button context
}

// Current half move
let _move = {
    WorB: "w",
    notation: "", // i.e. R1xf1+
    delay: 0,  // if (-1) wait; else number of seconds
    par: 0, // scored value
    comment: "",
    altMove: {}, // move, optional
    startSquare: {}, // location before moving {alpha:'a5',file:0,rank:4}
    endSquare: {}, // location after, except enPassant and castling
    pieceType: "", // one of "prbnqk"
    disambiguate: "",  // Only used when 2 pieces can move to the end square
    promotionPiece: "", // one of "rbnq"
    captureMove: false, // True only when move is a capture
    checkResult: false,
    mateResult: false,
    enPassant: "=",
}

// ------------------ helper/utility functions ----------------

function index2alpha( file, rank ) {
    return( "abcdefgh"[file] + "12345678"[rank] );
}

function index2node( file, rank ) {
    return document.getElementById(index2alpha(file,rank));
}

function alpha2index( square ) {
    let cell = [];
    cell[0] = _fileToX[ square[0] ];
    cell[1] = 7- _rankToY[ square[1] ];
    return cell;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function nodeToSquareType(node) {
    let sq = {};
    if( node.className == "piece" )
        node = node.parentElement;
    let alpha = node.id;  // the square div is "id=a8"
    sq.alpha = alpha;
    sq.file = _fileToX[alpha[0]];
    sq.rank = _rankToY[alpha[1]];
    return sq;
}


// ----------------- browser interactions ---------------------
let _dragZones = null;
let _activePiece = null; // type of _move not node


function clickEvent(e) {
    audioResult = null;
    if( _activePiece ) {
        // Second click is an attempted or aborted move
        if( validLandingSquare(e.currentTarget) ) {
            return makeMove( _activePiece );
        } else {
            resetClickDrag();
            _audioResult = _audioIllegal;
            return false;
        }
    } else {
        // set the startSquare
        if( isSquareOccupied(e.currentTarget) ) {
            _activePiece = pickedValidPiece( e.currentTarget );
            if( _activePiece ) {
                // Highlight the parent of the piece image
               highlightSquare( e.currentTarget, "click-overlay" );
               _showPossibles( _activePiece );
               return false;
            }
        }
    }
    _audioResult = _audioIllegal;
    return false;
};

function isSquareOccupied(node, className = "piece" ) {
    if( node.className != className )
        node = node.querySelector(`.${className}`);
    return (node != null);
}

function validLandingSquare(node) {
    if( _activePiece == null )
        // No preceding click or drag
        return false;
    if( isSquareOccupied(node) ) {
        let piece = getPieceFromNode(node);
        if( piece[0] == _activePiece.WorB )  // same color, no good
            return false;

        _activePiece.captureMove = true;
//fix dup?        removePiece(node.id);
    } else {
        _activePiece.captureMove = false;
    }

// determine candidate square
    _activePiece.endSquare = {};
    _activePiece.endSquare.alpha = node.id;
    _activePiece.endSquare = nodeToSquareType( node );
    return true;
}

function pickedValidPiece(node) {
    let move = {}
    if( !isSquareOccupied(node) ) {
        // Clicked an unoccupied square
        return null;
    }   
    piece = getPieceFromNode(node);
    if( _game.WorB != piece[0] ) {
        // Wrong color piece
        return null;
    }
    move.WorB = piece[0];
    move.pieceType = piece[1];
    move.startSquare = nodeToSquareType( node );
    return move;
}

function getPieceFromNode(node) {
    if( node.className != "piece" )
        node = node.querySelector(`.piece`);
    if( node )
        return node.getAttribute('data-group');
    else
        return null;
}

window.addEventListener('resize', () => {
    resizeBoard(window.innerWidth, window.innerHeight);
});

document.getElementById('forwardBtn').addEventListener('click', () => {
    playStep(); // Run the next set to moves
});

function resizeBoard(w,h) {
    // We want the largest square board without squeezing the sidebar
    console.log(`Viewport width: ${w}px, height: ${h}px`);
    w = document.documentElement.clientWidth;
        h = document.documentElement.clientHeight;

    let r = document.querySelector(':root');
    const rootStyles = getComputedStyle(document.documentElement);
    side = document.getElementById('sidebar').offsetWidth;
    _squareSize = Math.floor(Math.min(w-side,h)/8);

    var width = (_squareSize*8); 
    r.style.setProperty('--board-size', `${width}px`);
    r.style.setProperty('--square-size', `${_squareSize}px`);
};

// TODO: this function is currently unused, waiting on adding showing piece moves
function smoothanimateImage(x, y) {
    const img = document.getElementById('moving-img');
    const currentX = parseInt(img.style.left, 10) || 0;
    const currentY = parseInt(img.style.top, 10) || 0;

    const stepX = (x - currentX) / 20; // Smooth steps for X
    const stepY = (y - currentY) / 20; // Smooth steps for Y

    let count = 0;
    const interval = setInterval(() => {
        if (count >= 20) {
            clearInterval(interval);
            return;
        }
        img.style.left = `${currentX + stepX * count}px`;
        img.style.top = `${currentY + stepY * count}px`;
        count++;
    }, 20); // Move every 20ms
}

// ------------------ available spaces of a piece ------------------
let moveTos = [];  // alpha of piece i.e. "a8"
    const availFunctions = [
        (p) => availPawnSquares(p),
        (p) => availRookSquares(p),
        (p) => availKnightSquares(p),
        (p) => availBishopSquares(p),
        (p) => availQueenSquares(p),
        (p) => availKingSquares(p)
];

function probeOppOnSquare( x, y, ownColor ) {
    // Bounds check
    if( x < 0 || x > 7 ) return false;
    if( y < 0 || y > 7 ) return false;

    const square = document.getElementById(index2alpha(x,y));
    const piece = getPieceFromNode(square);

    if( !piece ) return false;
    if( ownColor == piece[0] ) 
        // Running into own color
        return false;

    highlightSquare( square, "probe-overlay" );
    return true;
}

function probeSquare( x, y, ownColor ) {
    // Bounds check
    if( x < 0 || x > 7 ) return false;
    if( y < 0 || y > 7 ) return false;

    const square = document.getElementById(index2alpha(x,y));
    const piece = getPieceFromNode(square);

    if( piece && ownColor.includes(piece[0]) ) 
        // Running into own color
        return false;

    highlightSquare( square, "probe-overlay" );
    return (piece == null);
}

function probeFile(piece, n, capture) {
    let x = piece.startSquare.file;
    let y = piece.startSquare.rank;
    for( i=1; i<=n; i++) {
        if( !probeSquare( x, y+i, capture )) break; 
    }
    for( i=1; i<=n; i++) {
        if( !probeSquare( x, y-i, capture )) break; 
    }
}

function probeRank(piece, n, capture) {
    let x = piece.startSquare.file;
    let y = piece.startSquare.rank;
    for( i=1; i<=n; i++) {
        if( !probeSquare( x+i, y, capture )) break; 
    }
    for( i=1; i<=n; i++) {
        if( !probeSquare( x-i, y, capture )) break; 
    }
}

function probeDiagonals(piece, n, capture) {
    let x = piece.startSquare.file;
    let y = piece.startSquare.rank;
    for( i=1; i<=n; i++) {
        if( !probeSquare( x+i, y+i, capture )) break; 
    }
    for( i=1; i<=n; i++) {
        if( !probeSquare( x+i, y-i, capture )) break; 
    }
    for( i=1; i<=n; i++) {
        if( !probeSquare( x-i, y+i, capture )) break; 
    }
    for( i=1; i<=n; i++) {
        if( !probeSquare( x-i, y-i, capture )) break; 
    }
}

function probeN(piece, n, capture) {
    let x = piece.startSquare.file;
    let y = piece.startSquare.rank;
    for( i=1; i<=n; i++) {
        y++;
        probeSquare( x, y, capture ); 
    }
}

function availPawnSquares(piece) {
    const probeFunc = [ 
        (p,n,c) => probeN(p,n,c),
        (p,n,c) => probeS(p,n,c),
    ];

    let distance = 1;
    if( piece.WorB == "w" ) {
        if( piece.startSquare.rank == 1 ) distance++;
        probeFunc[0](piece, distance, "wb");
    } else {
        if( piece.startSquare.rank == 6 ) distance++;
        probeFunc[1](piece, distance, "wb");
    }

    // Capture moves
    distance = (piece.WorB=="w") ? 1:-1;
    x = piece.startSquare.file;
    y = piece.startSquare.rank + distance;
    probeOppOnSquare( x-1, y, piece.WorB );
    probeOppOnSquare( x+1, y, piece.WorB );
}

function availRookSquares(piece) {
    probeRank(piece, 7, piece.WorB );
    probeFile(piece, 7, piece.WorB );
}

function availKnightSquares(piece) {
    x = piece.startSquare.file;
    y = piece.startSquare.rank;
    probeSquare( x-1, y+2, piece.WorB  );
    probeSquare( x+1, y+2, piece.WorB  );
    probeSquare( x-1, y-2, piece.WorB  );
    probeSquare( x+1, y-2, piece.WorB  );
    probeSquare( x-2, y+1, piece.WorB  );
    probeSquare( x-2, y-1, piece.WorB  );
    probeSquare( x+2, y+1, piece.WorB  );
    probeSquare( x+2, y-1, piece.WorB  );
}

function availBishopSquares(piece) {
    probeDiagonals(piece, 7, piece.WorB);
}

function availQueenSquares(piece) {
    availRookSquares(piece);
    availBishopSquares(piece);
}

function availKingSquares(piece) {
    probeRank(piece, 1, piece.WorB);
    probeFile(piece, 1, piece.WorB);
    probeDiagonals(piece, 1, piece.WorB);
}

function _showPossibles(piece) {
    moveTos = [];
    funcIndex = "prnbqk".indexOf(piece.pieceType);
    if( availFunctions[funcIndex](piece) ) 
        return;  // function set globals

}

// ------------------ piece location and placement ------------------

// ------------------ Move Functions --------------------
function blockedMoveDiagonal(move = _move) {
    // Require open squares from start to end exclusive
    let x1 = move.startSquare.file;
    let x2 = move.endSquare.file;
    let y1 = move.startSquare.rank;
    let y2 = move.endSquare.rank;

    let yinc = 1;
    if( y2 < y1 ) yinc = -1;

    let xinc = 1;
    if( x2 < x1 ) xinc = -1;

    let steps = Math.abs(x1-x2);

    for( i=1; i<steps; i++) {
        // if piece on square fail
        x1 += xinc;
        y1 += yinc;
        if( isSquareOccupied( index2node(x1,y1)) )
            return true;
    }
    return false;
}

function blockedMoveRank(move = _move) {
    let y = move.startSquare.rank;
    let x1 = move.startSquare.file;
    let x2 = move.endSquare.file;
    let inc = 1;
    if( x1 > x2) inc = -1;
    let steps = Math.abs(x1-x2);
    for( i=1; i<steps; i++ ) {
        x1 += inc;
        // if piece on square fail
        if(  isSquareOccupied( index2node(x1,y)) )
            return true;
    }
    return false;
}

function blockedMoveFile(move = _move) {
    let x = move.startSquare.file;
    let y1 = move.startSquare.rank;
    let y2 = move.endSquare.rank;
    let inc = 1;
    if( y1 > y2) inc = -1;
    let steps = Math.abs(y1-y2);
    for( i=1; i<steps; i++ ) {
        y1 += inc;
        // if piece on square fail
        if( isSquareOccupied(index2node(x,y1) ) ) 
            return true;
    }
    return false;
}

function validKingMove(move = _move) {
    // The end square is always empty when we get here
    const fDiff = move.startSquare.file - move.endSquare.file;
    const rDiff = move.startSquare.rank - move.endSquare.rank;
    if( (fDiff == 0) && (Math.abs(rDiff) == 1) ) return true;
    if( (rDiff == 0) && (Math.abs(fDiff) == 1) ) return true;
    if( (Math.abs(fDiff) == 1) && (Math.abs(rDiff) == 1) ) return true;
    return false;
}

function validKnightMove(move = _move) {
    // No blocking for knights
    const fDiff = move.startSquare.file - move.endSquare.file;
    const rDiff = move.startSquare.rank - move.endSquare.rank;
    if( (Math.abs(fDiff) == 1) && (Math.abs(rDiff) == 2) ) return true;
    if( (Math.abs(fDiff) == 2) && (Math.abs(rDiff) == 1) ) return true;
    return false;
}

function validBishopMove(move = _move) {
    const fDiff = move.startSquare.file - move.endSquare.file;
    const rDiff = move.startSquare.rank - move.endSquare.rank;
    if( Math.abs(fDiff) != Math.abs(rDiff) ) 
        // Does not share diagonal
        return false;
    return !blockedMoveDiagonal( move );
}

function validRookMove(move = _move) {
    if( move.startSquare.file == move.endSquare.file ) {
        return !blockedMoveFile( move );
    }
    if( move.startSquare.rank == move.endSquare.rank ) {
        return !blockedMoveRank( move );
    }
    return false
}

function validQueenMove(move = _move) {
    if( validRookMove(move)) 
        return true;
    return validBishopMove(move);
}

function validPawnMove(move = _move) {
    const file = move.startSquare.file;
    const endFile = move.endSquare.file;
    const rank = move.startSquare.rank;
    const endRank = move.endSquare.rank;
    let direction = 1;
    let initialRank = 1;

    if( move.WorB =='b' ) {
        direction = -1;
        initialRank = 6;
    }

    if ( !move.captureMove ) {
        // moving ahead
        if( file != endFile) return false;
        if( rank == initialRank ) {
            if( rank+(2*direction) == endRank ) {
                if( blockedMoveFile() ) return false;
                    _game.enPassant = index2alpha(file, rank+direction);
                return true;
            }
        }
        if( rank+direction == endRank) return true;
        return false;
    }
    // Capturing
    if( Math.abs(file-endFile) != 1 ) return false;
    if( rank+direction != endRank ) return false;
    if( move.enPassant == move.endSquare.alpha )  
        removePiece( index2alpha(endFile, endRank-direction) );
    return true;
}

    const moveFunctions = [
        (m) => validPawnMove(m),
        (m) => validRookMove(m),
        (m) => validKnightMove(m),
        (m) => validBishopMove(m),
        (m) => validQueenMove(m),
        (m) => validKingMove(m),
];

function identifyPiece(node) {
    const colorType = _move.WorB + _move.pieceType;
    const candidates = document.querySelectorAll(`[data-group="${colorType}"]`);
    if( !candidates ) {
        console.log(`No pieces of type:${colorType} on board; move: ${_move.notation}`);
        return;
    };

    for (const node of candidates) {
        _move.startSquare = nodeToSquareType(node.parentNode);
        funcIndex = "prnbqk".indexOf(_move.pieceType);
        if( moveFunctions[funcIndex]() ) 
            return;  // function set globals
    };
    _move.startSquare = {};
    console.log("No match for move: " + `${_move}`);
};

function moveCastle(notation) {
    // Handle special castling notation
    if (notation.includes("0-0-0") || notation.toLowerCase().includes("o-o-o")) {
        // Queen side castle
        if( _move.WorB == "b" ) {
            movePiece("wk",  "e8",  "c8");
            movePiece("wr",  "a8",  "d8");
        } else {
            movePiece("wk",  "e1",  "c1");
            movePiece("wr",  "a1",  "d1");
        }
        return;
    }
    if (notation.includes("0-0") || notation.toLowerCase().includes("o-o")) {
        // King side castle
        if( _move.WorB == "b" ) {
            movePiece("wk",  "e8",  "g8");
            movePiece("wr",  "h8",  "f8");
        } else {
            movePiece("wk",  "e1",  "g1");
            movePiece("wr",  "h1",  "f1");
        }
    }
}

function parseMove(notation) {
    // enPassant option only lasts for a halfmove
    _move.enPassant = _game.enPassant;
    _game.enPassant = '-';

    // Determine piece type
    if ('RNBQK'.includes(notation[0])) {
        _move.pieceType = notation[0].toLowerCase();
        notation = notation.substring(1);
    } else {
        _move.pieceType = 'p';
    }

    // endSquare
    const regex = /[a-h][1-8]/; //FIX force to begin of string ^
    let result = notation.match(regex);
    _move.endSquare.alpha = result[0];
    // Compute to integers for eeasier comparions
    _move.endSquare.file = _fileToX[result[0][0]];
    _move.endSquare.rank = _rankToY[result[0][1]];

    if ( result.index != 0 ) {
        // Determine if move is ambiguous
        if ( '12345678abcdefgh'.includes(notation[0]) ) {
            _move.disambiguate = notation[0];
        } else {
            _move.disambiguate = '';
        }
    }
    // Determine if move is a capture
    _move.captureMove = notation.includes('x');
    if ( _move.captureMove )
        removePiece(_move.endSquare.alpha); 

    notation = notation.substring(2 + result.index);

    // Determine if promotion
    if ('RNBQ'.includes(notation[0])) {
        _move.promotionPiece = notation[0].toLowerCase();
        notation = notation.substring(1);
    }

    _move.checkResult = '+'.includes(notation[0]);
    _move.mateResult = '#'.includes(notation[0]);

    return true;
}

/*
.element {
    transform: translateZ(0); // Create a new layer
    animation: move 2s infinite;
}

// Pause heavy processing during animation
let animationInProgress = true;

// Simulated animation
setTimeout(() => {
    animationInProgress = false;
}, 2000);

if (!animationInProgress) {
    // Perform other tasks
}
*/

let _yEnd, _xEnd = 5; // Trying to target 5 pixels/frame
let _tImg = document.getElementById("transitionPiece");
async function transitionPiece() {
    // Focus transition piece
    let x, y = 0
    const piece = _move.WorB + _move.pieceType;
    _tImg.src = `/images/${_gameTheme}/wr.png`;
    _tImg.style.visibility = "visible";
    x = _move.startSquare.file;
    y = (7 - _move.startSquare.rank);
    _xEnd = _move.endSquare.file - x;
    _yEnd = (7 - _move.endSquare.rank) - y;
    _tImg.style.top = (y*_squareSize) +"px";
    _tImg.style.left = (x*_squareSize) +"px";
    console.log(`start=${_move.startSquare.alpha} end=${_move.endSquare.alpha} _xEnd=${_xEnd} _yEnd=${_yEnd}`);
    animateImage(); 
    // Unfocus transition piece();
    _tImg.style.visibility = "hidden";
}

async function animateImage() {
    let x = parseInt(_tImg.style.left,10);
    let y = parseInt(_tImg.style.top,10);
    position = _xEnd + x;
    _tImg.style.left = position + "px";
    position = _yEnd + y;
    _tImg.style.top = position + "px";

    // Stop when we reach the endSquare
    x = Math.round(x/_squareSize);
    y = (7 - Math.round((y/_squareSize)));
console.log(`file=${_move.startSquare.file} rank=${_move.endSquare.rank} x=${x} y=${y} _tImg.top=${_tImg.style.top} _tImg.left=${_tImg.style.left} `);

    if (( x != _move.endSquare.file) || (y != _move.endSquare.rank)){
        // Move some more
        requestAnimationFrame(animateImage);
    } else {
        return;
    }
    
}


function movePiece( piece, start, end ) {
    removePiece(end);
    removePiece(start);
    addPieceToBoard( piece, end);
};

function removePiece(square) {
    const container = document.getElementById(square);
    if( container ) container.replaceChildren();
};

function addPieceToBoard( piece, square) {

    let container = document.getElementById(square);
    const img = document.createElement("img");
    img.className = "piece";
    img.setAttribute("data-group", piece);
    img.setAttribute("src", `/images/${_gameTheme}/${piece}.png` );
    container.appendChild(img);

        // Add dragstart listener to the image
        img.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", e.currentTarget.id);
            e.dataTransfer.setDragImage(img, _squareSize/2,_squareSize/2);
            _activePiece = pickedValidPiece( e.currentTarget );
            if( _activePiece ) {
                highlightSquare( e.currentTarget, "drag-overlay" );
            } else {
                e.preventDefault();
            }
        });

    // Undo any previous check
    unhighlightSquare( document, "check-overlay" );

    // Highlight checked King
    if( _move.checkResult || _move.mateResult ) { 
        const checkedKing = (piece[0] == "w") ? "bk" : "wk";
        const king = document.querySelectorAll(`[data-group="${checkedKing}"]`)[0];
        highlightSquare( king.parentElement, "check-overlay" );
        if( _move.mateResult ) {
            // Lay down the king
            king.style.transform = 'rotate(60deg)';  
        }
    }
};


// ------------------------- game control functions -------------------
async function clearBoard() {
    for( let f=0; f<8; f++ ) {
        for( let r=0; r<8; r++ ) {
            removePiece(index2alpha(f,r));
        }
    }
}    

function setupGame( fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w kqKQ - 0 0" ) {
    // FEN notation for initial board setup
    const parts = fen.split(" ");
    _game.initalBoard = parts[0];
    _move.WorB = parts[1];
    _game.castling = parts[2];
    _game.enPassant = parts[3];
    _game.halfMoves = parts[4];
    _game.fullMoves = parts[5];

    const ranks = parts[0].split("/");
    if (ranks.length != 8) {
        console.log(`Invalid FEN:${fen}`);
        return;
        }

    // Drop pieces from any previous game
    clearBoard();

    // Go thru the ranks 8 to 1
    for (let rank = 0; rank < ranks.length; rank++) {
        let fileIndex = 0;
        let boardRank = _boardRanks[rank];
        for (const p of ranks[rank]) {
            if ('prnbqkPRNBQK'.includes(p)) {
                // FEN syntaz white pieces are uppercase
                let lowPiece = p.toLowerCase();
                if (p == lowPiece) {
                    piece = "b" + p;
                }
                else {
                    piece = "w" + lowPiece;
                }
                addPieceToBoard(piece, `${_boardFiles[fileIndex]}${boardRank}` );
                fileIndex++;
            } else if(_boardRanks.includes(p)) {
                // skips empty squares
                fileIndex += parseInt(p, 10);
            }
        }
    }
};

// Add audio files, use _audio*.play();
const _audioMove = new Audio('/audio/move.mp3');
const _audioWrong = new Audio('/audio/wrong.mp3');
const _audioCorrect = new Audio('/audio/correct.mp3');
const _audioIllegal = new Audio('/audio/illegal.mp3');
const _audioCapture = new Audio('/audio/capture.mp3');
let _audioResult = null;

function defineBoard() {
    let child, img  = null;
    // Populate the global variables
    resizeBoard(window.innerWidth, window.innerHeight);

    // Define the squares, the pieces are added later
    const container = document.getElementById("board");

    for (let rank = 0; rank < _boardRanks.length; rank++) {
        for (let file = 0; file < _boardFiles.length; file++) {
            child = document.createElement("div");
            child.className = `square file-${_boardFiles[file]} rank${_boardRanks[rank]}`;
            child.id=`${_boardFiles[file]}${_boardRanks[rank]}`;
            img = "url('" + _origin + "/images/" + _gameTheme;
            img += ((rank+file)%2 == 1 ) ? "/darkSquare.png')" : "/lightSquare.png')";
            child.style.background = img;
            child.style.backgroundSize = "cover";
            container.appendChild(child);

            // Make squares clickable
            child.addEventListener('click', (e) => {
                let nextStep = clickEvent(e);
                if( _audioResult )
                    try {
                        _audioResult.play();
                    } catch (error) {
                        console.error("Click event audio playback failed:", error);
                    }
                if(nextStep) playStep();
            });

            // Allow squares to respond to drag&drops
            child.addEventListener('dragenter', (e) => {
                e.preventDefault(); 
                highlightSquare( e.currentTarget, "drag-overlay" );
            });

            child.addEventListener("dragover", (e) => {
                e.preventDefault(); 
            });

            child.addEventListener("dragleave", (e) => {
                unhighlightSquare( e.currentTarget, "drag-overlay" );
            });

            // Add drop listener to drop zones
            child.addEventListener("drop", (e) => {
                e.preventDefault();
                if( _activePiece == null ) return;
                if( !validLandingSquare(e.currentTarget) ) {
                    _audioIllegal.play();
                    return;
                }
                let nextStep = makeMove( );
                if( _audioResult )
                    try {
                        _audioResult.play();
                    } catch (error) {
                         console.error("Drop event audio playback failed:", error);
                    }
                if(nextStep) playStep();
            });
        }
    };
};

function unhighlightSquare( square, className ) {
    let elements = square.getElementsByClassName(className);
    Array.from(elements).forEach(element => {
        element.remove();
    });
}

function highlightSquare( square, className ) {
    let child = document.createElement("div");
    child.className = "square "+className;
    square.appendChild(child);
}

// ----------------- game control functions --------------------- //
function resetClickDrag(check = false) {
    _activePiece = null;
    unhighlightSquare( document, "probe-overlay" );
    unhighlightSquare( document, "click-overlay" );
    unhighlightSquare( document, "drag-overlay" );
    unhighlightSquare( document, "thumbs-overlay" );
    if( check )
        unhighlightSquare( document, "check-overlay" );
}

function placeThumbsUp(square) {
    let container = document.getElementById(square);
    const img = document.createElement("img");
    img.id = "thumbs-up";
    img.className = "thumbs-overlay";
    img.setAttribute("src", `/images/thumbs-up.png` );
    container.appendChild(img);
}

function makeMove( move = _activePiece ) {
    _audioResult = null;
    const typeIndex = 'prnbqk'.indexOf(move.pieceType);
    if( ! moveFunctions[typeIndex](move) ) {
        // invalid move
        _audioResult = _audioIllegal;
        return false;
    }

    let note = _activePiece.pieceType.toUpperCase();
    if( note == "P" ) {
        note = "";
        if( _activePiece.captureMove ) {
            note = _activePiece.startSquare.alpha[0];
        }
    }
    if( _activePiece.captureMove ) {
        note += "x";
    }
    note += _activePiece.endSquare.alpha;

    for (const item of _goodMoves) {
        if( note == item.note ) {
            if( item.played == false ) {
                _currentScore += item.par;
                item.played == true;
                _positiveMove = true;
                _audioResult = _audioCorrect;
            }
            if( item.alt == false ) {
                // Found the game preferred answer
                return true;
            } else {
                // Found the alt answer, so allow another shot
                placeThumbsUp(_activePiece.endSquare.alpha);
                return false;
            }
        }
    }
    
    // Wrong, so move along
    _audioResult = _audioWrong;
    return true;
}

async function playStep() {
    if( _game.iStep == 0 ) {
        // First step, so show summary in sidebar
        showSummaryInSidebar();
        _game.moveCount = 0;
    }

    if( _game.iStep == _game.steps.length )
        // Game over, nothing to do
        return;

    // Normal play
    resetClickDrag(true);
    _step = _game.steps[_game.iStep];
    for( _step.iMove = 0; _step.iMove < _step.length; _step.iMove++ ) {
        _move = _step[_step.iMove];
        await playMove();
    }
    showStepInSidebar();
    showScoreInSidebar();
    _game.iStep++;

    if( _game.iStep == _game.steps.length ) {
        // Finished last step, show result
        showGameResult();

        if( _game.currentPosition == _game.endingPosition )
            console.log("%cSuccess -" +`${_game.summary}`, "color: green;" );
        else
            console.log("%cFailed -" + `${_game.summary} - ${_game.currentPosition}`, "color: red;" );
        console.log(`${_game.endingPosition}`);
        return;
    }

    // Setup scoring for next step
    let half = _game.steps[_game.iStep][0];
    _goodMoves = [];
    _goodMoves.push( { "note":half.notation, "par":half.par, "alt":false, "played":false} );
    if (Array.isArray(half.alts)) { 
        half.alts.forEach(item => {
            _goodMoves.push( { "note":item.notation, "par":item.par, "alt":true, "played":false} );
    });
};


    //Wait for a user action to execute the next step
}

// Fetch data from the JSON URL
async function fetchGame(url) {
    try {
        const response = await fetch(url);

        // Check if the request was successful
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Parse the JSON from the response
        _game = await response.json();
        console.log("fen="+_game.startingPosition);
        return setupGame(_game.startingPosition);
    } catch (error) {
        console.error('Error fetching JSON:', error);
    }
}

// Fetch data from the JSON URL
async function readGameSet(url) {
    try {
        const response = await fetch(url);

        // Check if the request was successful
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Parse the JSON from the response to load the global _gameSet{}
        _gameSet = await response.json();
        console.log("gameSet read:"+url);
    } catch (error) {
        console.error('Error fetching JSON:', error);
    }

    return;
}

function getCurrentFEN() {
    let fen = "";
    let spaces = 0;
    const _boardFiles="abcdefgh";

    for (let rank = 7; rank >= 0; rank--) {
        for (let file = 0; file < _boardFiles.length; file++) {
            parent = document.getElementById(index2alpha(file,rank));
            const child = parent.children[0];

            if( child != null ) {
                if( spaces != 0 ) {
                    fen += `${spaces}`;
                    spaces = 0;
                }
                const dataGroup = child.getAttribute('data-group');
                pieceColor = dataGroup[0];
                pieceType = dataGroup[1];
                if( pieceColor == "w" ) pieceType = pieceType.toUpperCase();
                fen += pieceType;
            } else {
                spaces += 1;
            }
        }
        if( spaces != 0 ) {
            fen += `${spaces}`;
            spaces = 0;
        }
        if( rank > 0 ) fen += "/"
    }
    _game.currentPosition = fen
    return;
}


async function playMove() {
    _move = _step[_step.iMove];
    _move.startSquare = {};
    _move.endSquare = {};
    if ("0oO".includes(_move.notation[0])) {
        moveCastle(_move.notation);
    } else {
        parseMove(_move.notation);
        identifyPiece();
        removePiece(_move.startSquare.alpha);
        transitionPiece();
        if( _move.promotionPiece )
            _move.pieceType = _move.promotionPiece;
        addPieceToBoard( _move.WorB + _move.pieceType, _move.endSquare.alpha);

    }
    if( _move.delay ) 
        await sleep( _move.delay * 1000 );
    _game.WorB = (_move.WorB == 'w') ? "b" : "w";
    return;
};

// --------------- Sidebar functions ---------------------------
function showStepInSidebar() {
    let text, white, black, par = "";

    m = 0; 
    while( m < _step.length ) {
        if(( m+1 <  _step.length ) && ! _step[m].comment ) {
            // look ahead for a full move
            // first half move is always white and never scored
            white = _step[m++].notation;
            black = _step[m].notation;
            _game.moveCount++;
        }
        else {
            // Handle as a half move
            if( _step[m].WorB == "w" ) {
                _game.moveCount++;
                white = _step[m].notation;
                black = "...";
            } else {
                white = "...";
                black = _step[m].notation;
            }
        }

        text = `<p class="move-count">${_game.moveCount}:</p>`;
        text += `<p class="move-half">${white}</p>`
        if( _step[m].par ) {
            // Add score if any
            if(_positiveMove) {
                par = "<p class='move-positive'> ";
                _positiveMove = false;
            } else {
                par = "<p class='move-negative'> ";
            };
            par += `Score: ${_step[m].par}</p>`;
        } else {
            par = "<p class='move-negative'> </p>";
        }
        text += par;
        text += `<p class="move-half">${black}</p>`;
        addToSidebar( text, "move-div" );

        if( _step[m].comment ) {
            // Add comment
            addToSidebar( `<p>${_step[m].comment}</p>`, "sidebar-div" );
        }
        text = "";
        m++;
    }
}

function showGameResult() {
    let ranks = [
        { "min":95, "rank":"2400+" },
        { "min":81, "rank":"2200-2399" },
        { "min":66, "rank":"2000-2199" },
        { "min":51, "rank":"1800-1999" },
        { "min":36, "rank":"1600-1799" },
        { "min":21, "rank":"1400-1599" },
        { "min":6, "rank":"1200-1399" },
        { "min":0, "rank":"Under 1200" }
        ];

    const board = document.getElementById("board");
    let finalRank = "";
    ranks.forEach(item => {
        if( (finalRank == "") && (item.min <= _currentScore) ) {
            finalRank = item.rank;
        }
    });

        let div = document.createElement("div");
        div.id = "result-overlay";
        div.className = "result-overlay";
        div.innerHTML = `Rank:${finalRank}`;
        board.appendChild(div);
}

function showScoreInSidebar() {
    score = document.getElementById("currentScore");
    score.innerHTML = `Total: ${_currentScore}`;
}

function showSummaryInSidebar() {
    let text =  `<h2>${_game.title}</h2>
    <h3>${_game.subtitle}</h3>
    <p><b>Annotator: </b>${_game.annotator}<br/>
    <b>Source: </b>${_game.source}<br/>
    <b>Opening: </b>${_game.opening}<br/><p/>`
    addToSidebar( text, "sidebar-div" );

    addToSidebar( `<p><b>Summary: </b>${_game.summary}</p>`, "sidebar-div");

    }

function addToSidebar( text, className="div" )
{
    let sidebar = document.getElementById( "sidebar-top" );
    const child = document.createElement("div");

        // Add classes and content to the child div
        child.className = className;
        child.id = "sidebar-0";
        child.innerHTML = text;
        sidebar.appendChild(child);
        sidebar.scrollTop = sidebar.scrollHeight;   
}
