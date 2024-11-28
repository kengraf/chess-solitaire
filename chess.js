// ------------------------- global variables -------------------

// To make the asscii string notation to matrix work easier
let _fileToX = { a:0, b:1, c:2, d:3, e:4, f:5, g:6, h:7 };  // _fileToX["c"] = 2
let _rankToY = { 1:0, 2:1, 3:2, 4:3, 5:4, 6:5, 7:6, 8:7 };  // _rankToY["5"] = 4
const _boardFiles ='abcdefgh';
const _boardRanks = '87654321';  // <div> position 0 is board rank 8
let _currentScore = 0;
let _captureMove = false;

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
  iMove: 0,  //Neede for back/forward button context
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
    if( _activePiece ) {
      // Second click is an attempted move
      if( validLandingSquare(e.currentTarget) ) {
        makeMove( _activePiece );
      }
    } else {
    if( !isSquareOccupied(e.currentTarget) ) { // Clicked an open square
      return;
    }
    if( !pickedValidSquare(e.currentTarget) ) { // Picked wrong color
      return;
    }
    // Highlight the parent of the piece image
    _activePiece = pickedValidSquare( e.currentTarget );
    if( _activePiece ) {
      highlightSquare( e.currentTarget, "click-overlay" );
    }
  }
};

function makeMove( toSquare ) {
      const typeIndex = 'prnbqk'.indexOf(_activePiece.startSquare.pieceType);
      if( moveFunctions[typeIndex]() ) {
        // Valid move
        scoreMove( _activePiece );
        playStep();
     }

     _activePiece = null;
     unhighlightSquare( document, "click-overlay" );
     unhighlightSquare( document, "drag-overlay" );
}

function isSquareOccupied(parent, className = "piece" ) {
  return parent.querySelector(`.${className}`) !== null;
}

function validLandingSquare(node) {
      if( isSquareOccupied(node) ) {
        let piece = getPieceFromNode(node);
        if( piece[0] == _activePiece.WorB )  // same color, no good
          return false;
        
        _captureMove = true;
        removePiece(node.id);
      } else {
        _captureMove = false;
      }
      
// determine candidate square
      _activePiece.endSquare = {};
      _activePiece.endSquare.alpha = node.id;
      _activePiece.endSquare = nodeToSquareType( node );
      return true;
}

function pickedValidSquare(node) {
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
  node = node.querySelector(`.piece`);
  return node.getAttribute('data-group');
}

window.addEventListener('resize', () => {
  resizeBoard(window.innerWidth, window.innerHeight);
});

document.getElementById('halfBackBtn').addEventListener('click', () => {
  alert('Backward button clicked!');
  // todo add backward functionality here
  history.back(); // Go to the previous page
});

document.getElementById('halfForwardBtn').addEventListener('click', () => {
  alert('Forward button clicked!');
  // todo add forward functionality here
  history.forward(); // Go to the next page
});

document.getElementById('jumpBackBtn').addEventListener('click', () => {
  alert('Backward button clicked!');
  // todo add backward functionality here
  history.back(); // Go to the previous page
});

document.getElementById('jumpForwardBtn').addEventListener('click', () => {
  alert('Forward button clicked!');
  // todo add forward functionality here
  history.forward(); // Go to the next page
});

function resizeBoard(w,h) {
  // We want the largest square board without squeezing the sidebar
  console.log(`Viewport width: ${w}px, height: ${h}px`);
  w = document.documentElement.clientWidth;
   h = document.documentElement.clientHeight;
  
  let r = document.querySelector(':root');
  const rootStyles = getComputedStyle(document.documentElement);
  side = document.getElementById('sidebar').offsetWidth;
  squareSize = Math.floor(Math.min(w-side,h)/8);

  var width = (squareSize*8); 
  r.style.setProperty('--board-size', `${width}px`);
  r.style.setProperty('--square-size', `${squareSize}px`);
};

// TODO: this function is currently unused, waiting on adding showing piece moves
function smoothMoveImage(x, y) {
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

// ------------------ Move Functions --------------------
function blockedMoveDiagonal(move = _move) {
   return false;
   const fDiff = move.startSquare.file - move.endSquare.file;
   const rDiff = move.startSquare.rank - move.endSquare.rank;
   const container = document.getElementById(square);
   if( container.innerHTML != "" ) return true;
   return false;
}

function blockedMoveRank(move = _move) {
  let y = move.startSquare.rank;
  let xmin = move.startSquare.file;
  let xmax = move.endSquare.file;
  let inc = 1;
  if( move.startSquare.file > move.endSquare.file) {
    xmin = move.endSquare.file;
    xmax = move.startSquare.file;
  }
  for( x = xmin+inc; x<xmax; x +=inc) {
    // if piece on square fail
    const container = document.getElementById(index2alpha(x,y));
    if( container.innerHTML != "" ) return true;
    }
  return false;
}

function blockedMoveFile(move = _move) {
  let x = move.startSquare.file;
  let ymin = move.startSquare.rank;
  let ymax = move.endSquare.rank;
  let inc = 1;
  if( move.startSquare.rank > move.endSquare.rank ) {
    ymin = move.endSquare.rank;
    ymax = move.startSquare.rank;
  }
  for( y = ymin+inc; y<ymax; y +=inc) {
    // if piece on square fail
    const container = document.getElementById(index2alpha(x,y));
    if( container.innerHTML != "" ) return true;
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
  return !blockedMoveDiagonal(move.startSquare, move.endSquare );
}

function validRookMove(move = _move) {
  if( move.startSquare.file == move.endSquare.file ) {
    return !blockedMoveFile(move.startSquare, move.endSquare );
  }
  if( move.startSquare.rank == move.startSquare.rank ) {
    return !blockedMoveRank(move.startSquare, move.endSquare );
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


// ------------------ piece location and placement ------------------
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
      _move.startSquare.alpha = "e8";
      _move.endSquare.alpha = "c8";
      _move.pieceType = "k";
      movePiece();
      _move.startSquare.alpha = "a8";
      _move.endSquare.alpha = "d8";
      _move.pieceType = "r";
      movePiece();
    } else {
      _move.startSquare.alpha = "e1";
      _move.endSquare.alpha = "c1";
      _move.pieceType = "k";
      movePiece();
      _move.startSquare.alpha = "a1";
      _move.endSquare.alpha = "d1";
      _move.pieceType = "r";
      movePiece();
    }
    return;
  }
  if (notation.includes("0-0") || notation.toLowerCase().includes("o-o")) {
    // King side castle
    if( _move.WorB == "b" ) {
      _move.startSquare.alpha = "e8";
      _move.endSquare.alpha = "g8";
      _move.pieceType = "k";
      movePiece();
      _move.startSquare.alpha = "h8";
      _move.endSquare.alpha = "f8";
      _move.pieceType = "r";
      movePiece();
    } else {
      _move.startSquare.alpha = "e1";
      _move.endSquare.alpha = "g1";
      _move.pieceType = "k";
      movePiece();
      _move.startSquare.alpha = "h1";
      _move.endSquare.alpha = "f1";
      _move.pieceType = "r";
      movePiece();
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
  const regex = /[a-h][1-8]/;
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

async function transitionPiece() {
  return;  // TODO, implement animation
  // Focus transition piece
  const img = document.getElementById('transitionImage');
  const piece = _move.WorB + _move.pieceType;
  img.src = `/images/${_gameTheme}/${piece}.png`;
  img.style.visibility = "visible";
  let x = _move.startSquare.file * squareSize;
  let y = _move.startSquare.rank * squareSize;
  img.top = y+'px';
  img.left = x+'px';

  x = (_move.endSquare.file * squareSize) - x;
  y = (_move.endSquare.rank * squareSize) - y;
  img.style.transform = `translate(${x}+'px', ${y}+'px' 2.0s ease-in-out)`;
  
  // Unfocus transition piece();
  img.style.visibility = "hidden";
}

function movePiece(move = _move) {
  removePiece(move.startSquare.alpha);
  if( move.promotionPiece )
    move.pieceType = move.promotionPiece;
  addPieceToBoard( move.WorB + move.pieceType, move.endSquare.alpha);
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
      _activePiece = pickedValidSquare( e.currentTarget );
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
    const king = document.querySelectorAll(`[data-group="${colorType}"]`)[0];
    highlightSquare( king, "check-overlay" );
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
        clickEvent(e);
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
        if( validLandingSquare(e.currentTarget) ) {
           makeMove( _activePiece );
        };
      });
    }
  }
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

// --------------------- game control functions --------------------------- //
function scoreMove() {
  let half = _game.steps[_game.iStep][0];
  let goodMoves = [];
  goodMoves.push( { "note":half.notaton, "par":half.par} );
  if (Array.isArray(half.alts)) {
    half.alts.forEach(item => {
        goodMoves.push( { "note":item.notaton, "par":item.par} );
    });
  };
  
  let note = _activePiece.piece.toUppercase();
  if( note == "P" ) note = "";
  if( _captureMove ) note += "x";
  note += _activePiece._endSquare.alpha;
  
  goodMoves.forEach(item => {
      if( note == item.note )
        _currentScore += item.par;
    });
  
  playStep();
}

async function playStep() {
  if( _game.iStep == 0 ) {
    // First step, so show summary in sidebar
    showSummaryInSidebar();
    _game.moveCount = 0;
  }
  
  _step = _game.steps[_game.iStep];
  for( _step.iMove = 0; _step.iMove < _step.length; _step.iMove++ ) {
    _move = _step[_step.iMove];
    await playMove();
  }
  
  showStepInSidebar();
  showScoreInSidebar();
  _game.iStep++;

  if( _game.iStep == _game.steps.length ) {
    // Game over, show result
    showResultInSidebar();
    
    if( _game.currentPosition == _game.endingPosition )
        console.log("%cSuccess -" +`${_game.summary}`, "color: green;" );
    else
        console.log("%cFailed -" + `${_game.summary} - ${_game.currentPosition}`, "color: red;" );
    console.log(`${_game.endingPosition}`);
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
    // Add score if any
    par = (_step[m].par) ? `Score: ${_step[m].par}` : "";
    text += `<p class="move-score">${par}</p>`;
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

function showResultInSidebar() {
  addToSidebar( `<p style="font-size: 24pt; color:green"><b>Score: </b>${_currentScore}</p>`, "sidebar-div");

}

function showScoreInSidebar() {
  score = document.getElementById("currentScore");
  score.innerHTML = _currentScore;
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
