/* jshint esversion: 8 */
// ------------------------- global variables -------------------

// To make the asscii string notation to matrix work easier
const _fileToX = { a:0, b:1, c:2, d:3, e:4, f:5, g:6, h:7 };  // _fileToX["c"] = 2
const _rankToY = { 1:0, 2:1, 3:2, 4:3, 5:4, 6:5, 7:6, 8:7 };  // _rankToY[5] = 4
const _boardFiles ='abcdefgh';
const _boardRanks = '87654321';  // <div> position 0 is board rank 8
let _currentScore = 0;
let _positiveMove = false;
let _goodMoves = [];
let _squareSize = 60;
let _gameMode = "";
let _gameTheme = "";
let _loadURL = "";
let _gameSet = {};

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
    steps: [],  // _move objects
    iStep: 0, // Index of current step
};

// Current step (set of moves)
let _step = {
    moves: [],
    iMove: 0,  //Needed for back/forward button context
};

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
};

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
let _activePiece = null; // type of _move not node

function dropEvent(e) {
    if( _activePiece == null ) {
        _audioResult = _audioIllegal;
        return false;
    }
    
    if( validLandingSquare(e.currentTarget) ) {
        return userMove( _activePiece );
    } 
    resetClickDrag();
    _audioResult = _audioIllegal;
    return false;
}

function clickEvent(e) {
    _audioResult = null;
    if( _activePiece ) {
        // Second click is an attempted or aborted move
        if( validLandingSquare(e.currentTarget) ) {
            return userMove( _activePiece );
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
                _moveTos = [];
               showPossibles( _activePiece );
               return false;
            }
        }
    }
    _audioResult = _audioIllegal;
    return false;
}

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
    } else {
        _activePiece.captureMove = false;
    }

// determine candidate square
    _activePiece.endSquare = nodeToSquareType( node );
    return true;
}

function pickedValidPiece(node) {
    let sq = {};
    if( !isSquareOccupied(node) ) {
        // Clicked an unoccupied square
        return null;
    }   
    let piece = getPieceFromNode(node);
    if( _game.WorB != piece[0] ) {
        // Wrong color piece
        return null;
    }
    sq.WorB = piece[0];
    sq.pieceType = piece[1];
    sq.startSquare = nodeToSquareType( node );
    return sq;
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

document.getElementById('hintBtn').addEventListener('click', () => {
    playHint(); // Highlight piece to move
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
    let side = document.getElementById('sidebar').offsetWidth;
    _squareSize = Math.floor(Math.min(w-side,h)/8);

    var width = (_squareSize*8); 
    r.style.setProperty('--board-size', `${width}px`);
    r.style.setProperty('--square-size', `${_squareSize}px`);
}

// ------------------ available spaces of a piece ------------------
let _moveTos = [];  // alpha of piece i.e. "a8"
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

    let alpha = index2alpha(x,y);
    const square = document.getElementById(alpha);
    const piece = getPieceFromNode(square);

    if( !piece ) return false;
    if( ownColor == piece[0] ) 
        // Running into own color
        return false;

    highlightSquare( square, "probe-overlay" );
    _moveTos.push(alpha);
    return true;
}

function probeSquare( x, y, ownColor ) {
    // Bounds check
    if( x < 0 || x > 7 ) return false;
    if( y < 0 || y > 7 ) return false;

    let alpha = index2alpha(x,y);
    const square = document.getElementById(alpha);
    const piece = getPieceFromNode(square);

    if( piece && ownColor.includes(piece[0]) ) 
        // Running into own color
        return false;

    highlightSquare( square, "probe-overlay" );
    _moveTos.push( alpha );
    return (piece == null);
}

function probeFile(piece, n, capture) {
    let x = piece.startSquare.file;
    let y = piece.startSquare.rank;
    for( let i=1; i<=n; i++) {
        if( !probeSquare( x, y+i, capture )) break; 
    }
    for( let i=1; i<=n; i++) {
        if( !probeSquare( x, y-i, capture )) break; 
    }
}

function probeRank(piece, n, capture) {
    let x = piece.startSquare.file;
    let y = piece.startSquare.rank;
    for( let i=1; i<=n; i++) {
        if( !probeSquare( x+i, y, capture )) break; 
    }
    for( let i=1; i<=n; i++) {
        if( !probeSquare( x-i, y, capture )) break; 
    }
}

function probeDiagonals(piece, n, capture) {
    let x = piece.startSquare.file;
    let y = piece.startSquare.rank;
    for( let i=1; i<=n; i++) {
        if( !probeSquare( x+i, y+i, capture )) break; 
    }
    for( let i=1; i<=n; i++) {
        if( !probeSquare( x+i, y-i, capture )) break; 
    }
    for( let i=1; i<=n; i++) {
        if( !probeSquare( x-i, y+i, capture )) break; 
    }
    for( let i=1; i<=n; i++) {
        if( !probeSquare( x-i, y-i, capture )) break; 
    }
}

function probeN(piece, n, capture) {
    let x = piece.startSquare.file;
    let y = piece.startSquare.rank;
    for( let i=1; i<=n; i++) {
        y++;
        probeSquare( x, y, capture ); 
    }
}

function probeS(piece, n, capture) {
    let x = piece.startSquare.file;
    let y = piece.startSquare.rank;
    for( let i=1; i<=n; i++) {
        y--;
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
    let x = piece.startSquare.file;
    let y = piece.startSquare.rank + distance;
    probeOppOnSquare( x-1, y, piece.WorB );
    probeOppOnSquare( x+1, y, piece.WorB );
}

function availRookSquares(piece) {
    probeRank(piece, 7, piece.WorB );
    probeFile(piece, 7, piece.WorB );
}

function availKnightSquares(piece) {
    let x = piece.startSquare.file;
    let y = piece.startSquare.rank;
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
    
    // Castle spaces
    if( piece.WorB == "b" ) {
        if( _game.castling.includes("k")) probeSquare(6,7,piece.WorB);
        if( _game.castling.includes("q")) probeSquare(2,7,piece.WorB);
    } else {
        if( _game.castling.includes("K")) probeSquare(6,0,piece.WorB);
        if( _game.castling.includes("Q")) probeSquare(2,0,piece.WorB);
    }
}

function showPossibles(piece) {
    const funcIndex = "prnbqk".indexOf(piece.pieceType);
    if( availFunctions[funcIndex](piece) ) 
        return;  // function set global _moveTos array

}

function isChecked() {
    let piece = _activePiece;
    let checkingPieces = [];

    // Determine Opposing King square
    let king = (_game.WorB == "b") ? "wk" : "bk";
    let kingNode = document.querySelectorAll(`[data-group^="${king}"]`);
    let kingAlpha = kingNode[0].parentNode.id;

    // Temporary move the activePiece while eval of check
    pieceDelete(piece.startSquare.alpha);
    const img = pieceImageAdd( piece.WorB+piece.pieceType, piece.endSquare.alpha);

    let candidates = document.querySelectorAll(`[data-group^="${piece.WorB}"]`);
    for (const node of candidates) {
        let sq = pickedValidPiece( node );
        _moveTos = [];
        showPossibles(sq);
        if( _moveTos.includes(kingAlpha)) checkingPieces.push(node);
    }
    
    // Return activePiece, UI move made later
    img.remove();
    pieceAdd( piece.WorB+piece.pieceType, piece.startSquare.alpha);

    return checkingPieces;
}

function isMated() {
    let piece = _activePiece;
    const checkingPieces = isChecked();
    if( checkingPieces.length == 0 ) return false;
return false; // DEBUG and FIX

    // fix eval all squares around king
    let king = (_game.WorB == "b") ? "wk" : "bk";
    let kingNode = document.querySelectorAll(`[data-group^="${king}"]`);
    let sq = nodeToSquareType( kingNode );
    _moveTos = [];
    showPossibles(sq);
    let escapeSquares = _moveTos;
    // iterate if escape square is still check
    let candidates = document.querySelectorAll(`[data-group^="${piece.WorB}"]`);
    for( const escape of escapeSquares) {
        for (const node of candidates) {
            _moveTos = [];
            sq = nodeToSquareType( node );
            showPossibles(sq);
            if( _moveTos.includes(escape) == false )
                // King has an escape square
                return false;
        }
    }
    
    // If the King can't escape;; then check for blocking or capturing
    if( checkingPieces.length > 1 ) return true;

    //fix
    return false; 
}

// ------------------ piece location and placement ------------------

// ------------------ Move Functions --------------------

function identifyPiece() {
    // Moving based on game notation
    const colorType = _move.WorB + _move.pieceType;
    const candidates = document.querySelectorAll(`[data-group="${colorType}"]`);
    if( !candidates ) {
        console.log(`No (${colorType}) on board; Bad move: ${_move.notation}`);
        return false;
    }

    let legalPieces = [];
    for (const node of candidates) {
        // Cycle thru all the pieces of that type.
        _moveTos = [];
        let move = pickedValidPiece( node );
        showPossibles( move );
        unhighlightSquare( document, "probe-overlay" );

        if( _moveTos.includes(_move.endSquare.alpha) )
            // This piece can move to target square
            legalPieces.push(move.startSquare);
    }
    
    if( _move.disambiguate != "" ) {
        // Use disabigate notatoion to filter pieces
        for( let i=0; i<legalPieces.length; ) {
            if( legalPieces[i].alpha.includes(_move.disambiguate) == false )
                // Not correct rank or file
                legalPieces.splice(i,1);
            else
                ++i;
        }
    }
            
    if( legalPieces.length == 0 ) {
        // No piece can reach square
        console.log(`No (${colorType}) can make move: ${_move.notation}`);
        return false;
    }

    if( legalPieces.length > 1 ) {
        // Multiple pieces could move
        console.log(`Multiple (${colorType}) can make move: ${_move.notation}`);
        return false;
    }

    // Identified piece
    _move.startSquare = legalPieces[0];
    return true;
}

function castleAttempt( move ) {
    // Look at the pending move as apossible castle
    if( move.pieceType != "k" ) return null;
    if( move.startSquare.alpha[0] != "e" ) return null;
    if( move.endSquare.alpha[0] == "g" ) {
        // Kingside attempt
        if( (move.WorB == "b") && _game.castling.includes("k") )
            // _game.castling is updated when the move is made
            return "0-0";
        if( (move.WorB == "w") && _game.castling.includes("K") )
            return "0-0";
    }
      
    if( move.endSquare.alpha[0] == "c" ) {
        // Queenside attempt
        if( (move.WorB == "b") && _game.castling.includes("q") )
            // _game.castling is updated when the move is made
            return "0-0-0";
        if( (move.WorB == "w") && _game.castling.includes("Q") )
            return "0-0-0";
    }
      

    return null;
}

function moveCastle(notation) {
    // Handle special castling notation
    if (notation.includes("0-0-0") || notation.toLowerCase().includes("o-o-o")) {
        // Queen side castle
        if( _move.WorB == "b" ) {
            if( _game.castling.includes("q") ) {
                movePiece("bk",  "e8",  "c8");
                movePiece("br",  "a8",  "d8");
                 _game.castling.replace("q", ""); 
            }
        } else {
            if( _game.castling.includes("Q") ) {
                movePiece("wk",  "e1",  "c1");
                movePiece("wr",  "a1",  "d1");
                 _game.castling.replace("Q", ""); 
            }
        }
        return;
    }
    if (notation.includes("0-0") || notation.toLowerCase().includes("o-o")) {
        // King side castle
        if( _move.WorB == "b" ) {
            if( _game.castling.includes("k") ) {
                movePiece("bk",  "e8",  "g8");
                movePiece("br",  "h8",  "f8");
                 _game.castling.replace("k", ""); 
            }
        } else {
            if( _game.castling.includes("K") ) {
                movePiece("wk",  "e1",  "g1");
                movePiece("wr",  "h1",  "f1");
                 _game.castling.replace("K", ""); 
            }
        }
    }
}

function parseMove(notation) {

    // enPassant option only lasts for a halfmove
    _move.enPassant = _game.enPassant;
    _move.disambiguate = "";
    _move.promotionPiece = "";
    _game.enPassant = '-';

    // Peel off the special ending states
    let lastC = notation.charAt(notation.length - 1);
    if( lastC == "+" ) {
        _move.checkResult = true;
        notation = notation.slice(0, -1);
        lastC = notation.charAt(notation.length - 1);
    }
    if( lastC == "#" ) {
        _move.mateResult = true;
        notation = notation.slice(0, -1);
        lastC = notation.charAt(notation.length - 1);
    }
    if( "RNBG".includes(lastC) ) {
        // Promotion
        _move.promotionPiece = lastC;
        notation = notation.slice(0, -1);
    }

    // endSquare
    const regex = /[a-h][1-8]$/;
    let result = notation.match(regex);
    if ( result == null )
         return false;
    _move.endSquare.alpha = result[0];
    // Compute to integers for easier comparions
    _move.endSquare.file = _fileToX[result[0][0]];
    _move.endSquare.rank = _rankToY[result[0][1]];
    notation = notation.slice(0, -2);
    
    if( notation.length == 0 ) {
        // Unambiguous pawn move
        _move.pieceType = 'p';
        return true;
    }
    
    // Determine if move is a capture
    lastC = notation.charAt(notation.length - 1);
    _move.captureMove = (lastC == "x") ? true : false;
    if ( _move.captureMove ) {
        notation = notation.slice(0, -1);
    }

    // Determine piece type
    if ('RNBQK'.includes(notation[0])) {
        _move.pieceType = notation[0].toLowerCase();
        notation = notation.substring(1);
    } else {
        _move.pieceType = 'p';
    }

    if( notation.length == 0 )
        return true;
        
    // Determine if move is ambiguous
    if ( '12345678abcdefgh'.includes(notation[0]) ) {
       _move.disambiguate = notation[0];
       return true;
    } else {
        return false;
    }
    return (notation.length == 0);
}

function animateElement(element, keyframes, options) {
    return new Promise((resolve) => {
        const animation = element.animate(keyframes, options);
        animation.onfinish = resolve;
    });
}


async function executeMove(move) {  // Update the UI
    let floatAnimation = true;
    let imgSquare = document.getElementById(move.startSquare.alpha);
    const floatImage = imgSquare.querySelectorAll("[data-group]")[0];
    const boardDiv = document.getElementById("board");
    
    const x = move.startSquare.file * _squareSize;
    const y = (7 - move.startSquare.rank) * _squareSize;
    const xEnd = ((move.endSquare.file  * _squareSize));
    const yEnd = (((7 - move.endSquare.rank) * _squareSize));

     // Take the image out of the square and float it over the board
    boardDiv.appendChild(floatImage);

    // Move to end square
    const keyframes = [
        { transform: `translate(${x}px,${y}px)` },
        { transform: `translate(${xEnd}px,${yEnd}px)` }
        ];
    const options = { duration: 1000, iterations: 1, fill: "forwards" };

    // Create and play animation
    animateElement(floatImage, keyframes, options )
        .then(() => {
            floatAnimation = false;
        });

    while( floatAnimation )
        await sleep( 50 );

    // Just the moved piece on square
    floatImage.remove();
    pieceDelete(move.endSquare.alpha);
    pieceAdd( move.WorB + move.pieceType, move.endSquare.alpha);

    // Put promoted piece on target square
    if( move.promotionPiece ) {
        pieceDelete(move.endSquare.alpha);
        pieceAdd( move.WorB + move.promotionPiece, move.endSquare.alpha);
    }
        
    if( move.enPassant == move.endSquare.alpha ) {
        //Nuke the passed pawn
        move.endSquare.rank += (move.WorB == "w") ? 1 : -1;    
        move.endSquare.alpha = index2alpha(move.endSquare.file, move.enfSquare.rank);
        pieceDelete(move.endSquare.alpha);
    }
}

function movePiece( piece, start, end ) {
    // Fix here is where all UI things happen
    pieceDelete(end);
    pieceDelete(start);
    pieceAdd( piece, end);
}

function pieceDelete(square) {
    const container = document.getElementById(square);
    if( container ) container.replaceChildren();
}

function pieceImageAdd( piece, square) {
    let container = document.getElementById(square);
    const img = document.createElement("img");
    img.className = "piece";
    img.setAttribute("data-group", piece);
    img.setAttribute("src", `/images/${_gameTheme}/${piece}.png` );
    container.appendChild(img);
    return img;
}

function pieceAdd( piece, square) {
    const img = pieceImageAdd( piece, square );
    
    // Add dragstart listener to the image
    img.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", e.currentTarget.id);
        e.dataTransfer.setDragImage(img, _squareSize/2,_squareSize/2);
        _activePiece = pickedValidPiece( e.currentTarget );
        if( _activePiece ) {
            highlightSquare( e.currentTarget, "drag-overlay" );
            _moveTos = [];
            showPossibles( _activePiece );
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
}


// ------------------------- game control functions -------------------
async function clearBoard() {
    for( let f=0; f<8; f++ ) {
        for( let r=0; r<8; r++ ) {
            pieceDelete(index2alpha(f,r));
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
                let piece = "";
                if (p == lowPiece) {
                    piece = "b" + p;
                }
                else {
                    piece = "w" + lowPiece;
                }
                pieceAdd(piece, `${_boardFiles[fileIndex]}${boardRank}` );
                fileIndex++;
            } else if(_boardRanks.includes(p)) {
                // skips empty squares
                fileIndex += parseInt(p, 10);
            }
        }
    }
}

// Add audio files, use _audio*.play();
const _audioMove = new Audio("/audio/move.mp3");
const _audioWrong = new Audio("/audio/wrong.mp3");
const _audioCorrect = new Audio("/audio/correct.mp3");
const _audioIllegal = new Audio("/audio/illegal.mp3");
const _audioCapture = new Audio("/audio/capture.mp3");
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
            child.addEventListener("click", (e) => {
                let continuePlay = clickEvent(e);
                if( _audioResult == null ) _audioResult = _audioMove;
                try {
                    _audioResult.play();
                } catch (error) {
                    console.error("Click event audio playback failed:", error);
                }
                if(continuePlay) playStep();
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

                let continuePlay = dropEvent(e);
                if( _audioResult == null ) _audioResult = _audioMove;
                try {
                    _audioResult.play();
                } catch (error) {
                     console.error("Drop event audio playback failed:", error);
                }
                if(continuePlay) playStep();
            });
        }
    }
}

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
    if( check )
        unhighlightSquare( document, "check-overlay" );
}

function userMove( move = _activePiece ) {
    _audioResult = null;
    if( _moveTos.includes(move.endSquare.alpha) == false ) {
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
    const castled = castleAttempt( _activePiece );
    if( castled ) note = castled;
    
    let checked = "";
    if( isChecked().length > 0 ) {
        checked = "+";
        if( isMated() )
            checked = "#";
    }
    note += checked;
    
    // Look to see if our move matches the answer
    for (const item of _goodMoves) {
        if( note == item.note ) {
            _currentScore += item.par;
            item.played = true;
            _positiveMove = true;
            _audioResult = _audioCorrect;
            return true;
        }
    }
    
    // Wrong, so move along
    _audioResult = _audioWrong;
    return true;
}

async function playHint() {
    let square = {};
    if( _game.iStep == _game.steps.length )
        // Game over, nothing to do
        return;

    _move = _game.steps[_game.iStep][0];
    _game.WorB = _move.WorB;

    if ("0oO".includes(_move.notation[0])) {
        let king = (_game.WorB == "w") ? "wk" : "bk";
        square = document.querySelectorAll(`[data-group^="${king}"]`);
        square = square[0].parentElement;
    } else {
        _move.startSquare = {};
        _move.endSquare = {};
        if( ! parseMove(_move.notation) ) {
            console.log( `Bad move notation: ${_move.notation}` );
            return;
        }
        identifyPiece();
        square = document.getElementById(_move.startSquare.alpha);
    }
    highlightSquare( square, "probe-overlay" );
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
        getCurrentFEN();
        if( _game.currentPosition == _game.endingPosition )
            console.log("%cSuccess -" +`${_game.currentPosition}`, "color: green;" );
        else
            console.log("%cFailed -" + `${_game.currentPosition}`, "color: red;" );
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
    }


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
            const parent = document.getElementById(index2alpha(file,rank));
            const child = parent.children[0];

            if( child != null ) {
                if( spaces != 0 ) {
                    fen += `${spaces}`;
                    spaces = 0;
                }
                const dataGroup = child.getAttribute('data-group');
                let pieceColor = dataGroup[0];
                let pieceType = dataGroup[1];
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
        if( rank > 0 ) fen += "/";
    }
    _game.currentPosition = fen;
    return;
}

async function playMove() {
    _move = _step[_step.iMove];
    _game.WorB = _move.WorB;
      // Handle the castling special case
    if ("0oO".includes(_move.notation[0])) {
        moveCastle(_move.notation);
    } else {
        
        _move.startSquare = {};
        _move.endSquare = {};
        if( ! parseMove(_move.notation) ) {
            console.log( `Bad move notation: ${_move.notation}` );
            return;
        }
        if( identifyPiece() ) {
            await executeMove(_move);
        }
    }
    // fix play sound here or at end of executemove?

    if( _move.delay ) 
        await sleep( _move.delay * 1000 );
    _game.WorB = (_move.WorB == 'w') ? "b" : "w";
    return;
}

// --------------- Sidebar functions ---------------------------
function showStepInSidebar() {
    let text, white, black, par = "";

    let m = 0; 
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
        text += `<p class="move-half">${white}</p>`;
        if( _step[m].par ) {
            // Add score if any
            if(_positiveMove) {
                par = "<p class='move-positive'> ";
                _positiveMove = false;
            } else {
                par = "<p class='move-negative'> ";
            }
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

    if( _currentScore == 0 )
        // Just testing
        return;

    let finalRank = "";
    ranks.forEach(item => {
        if( (finalRank == "") && (item.min <= _currentScore) ) {
            finalRank = item.rank;
        }
    });

    let text =  `<h2>Rank: ${finalRank}</h2>`;
    addToSidebar( text, "sidebar-score" );
}

function showScoreInSidebar() {
    let score = document.getElementById("currentScore");
    score.innerHTML = `Score: ${_currentScore}`;
}

function showSummaryInSidebar() {
    let text = "";
    if(_game.title) text += `<h2>${_game.title}</h2>`;
    if(_game.subtitle) text += `<h3>${_game.subtitle}</h3>`;
    if(_game.white) text += `<p><b>White: </b>${_game.white}<br/>`;
    if(_game.black) text += `<p><b>Black: </b>${_game.black}<br/>`;
    if(_game.annotator) text += `<p><b>Annotator: </b>${_game.annotator}<br/>`;
    if(_game.source) text += `<b>Source: </b>${_game.source}<br/>`;
    if(_game.opening) text += `<b>Opening: </b>${_game.opening}<br/><p/>`;
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
