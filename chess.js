window.addEventListener('resize', () => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  resizeBoard(window.innerWidth, window.innerHeight);
});

function resizeBoard(w,h) {
  // Set the dimensions for max sqare board and min sidebar
  console.log(`Viewport width: ${w}px, height: ${h}px`);
  
  let r = document.querySelector(':root');
  const rootStyles = getComputedStyle(document.documentElement);
  let sideMin = parseInt(rootStyles.getPropertyValue('--sidebar-min-width'),10);
  squareSize = Math.floor(Math.min(w-sideMin,h)/32)*4;

  const boardWidth = (squareSize*8); 
  r.style.setProperty('--board-size', `${boardWidth}px`);
  r.style.setProperty('--square-size', `${squareSize}px`);
};

var startSquare = "";   // Where the piece is now
var endSquare = "";     // Where we are moving to
var promotionPiece = "";// Type of piece selected for pawn promotion
var captureMove = false; // True only when move is a capture


// To make the asscii string notation to matrix work easier
var fIndex = { a:0, b:1, c:2, d:3, e:4, f:5, g:6, h:7 };  // fIndex["c"] = 2
var rIndex = { 1:0, 2:1, 3:2, 4:3, 5:4, 6:5, 7:6, 8:7 };  // rIndex["5"] = 4

// JSON Object for game
var game = {
}

// Current half move
var move = {
  WorB: "w",
  notation: "", // i.e. R1xf1+
  delay: 0,  // if (-1) wait; else number of seconds
  par: 0, // scored value
  comment: "",
  altMove: {}, // move, optional
  startSquare: {}, // location before moving {alpha:'a5',file:0,rank:4}
  endSquare: {}, // 
  pieceType: "", // one of "prbnqk"
  disambiguate: "",  // Only used when 2 pieces can move to the end square
  promotionPiece: "", // one of "rbnq"
  checkResult: false,
  mateResult: false,
  enPassant: "=",
}

function index2alpha( file, rank ) {
  return( "abcdefgh"[file] + "12345678"[rank] );
}
function alpha2index( square) {
  let cell = [];
  cell[0] = "abcdefgh".indexOf(square[0] );
  cell[1] = 7-"12345678".indexOf(square[1] );
  return cell;
}


function loadGameNotation(url) {
  // TODO supercede this with test run functions
  // Read JSON object containing all game moves
  // TODO replace with real data just the notation for testing
  game = {moves:[]};
  game.moves.push({WorB:"w",notation:"e4"});
  game.moves.push({WorB:"b",notation:"d5"});
  game.moves.push({WorB:"w",notation:"exd5"});
  game.moves.push({WorB:"b",notation:"c5"});
  game.moves.push({WorB:"w",notation:"dxc6"});
  game.moves.push({WorB:"b",notation:"Qd7"});
  game.moves.push({WorB:"w",notation:"cxd7+"});
  game.moves.push({WorB:"b",notation:"a6"});
  game.moves.push({WorB:"w",notation:"fdxc8Q#"});
  for (const halfMove of game.moves) {
    move.WorB = halfMove.WorB;
    if( parseMove(halfMove.notation) ) {
      let id = identifyPiece();
      movePiece();
    }
  }
};

// ------------------ Move Functions --------------------
function blockedMoveDiagonal() {
   return false;
   const fDiff = move.startSquare.file - move.endSquare.file;
   const rDiff = move.startSquare.rank - move.endSquare.rank;
   const container = document.getElementById(square);
   if( container.innerHTML != "" ) return true;
   return false;
}

function blockedMoveRank() {
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

function blockedMoveFile() {
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

function validKingMove() {
  // The end square is always empty when we get here
  const fDiff = move.startSquare.file - move.endSquare.file;
  const rDiff = move.startSquare.rank - move.endSquare.rank;
  if( (fDiff == 0) && (Math.abs(rDiff) == 1) ) return true;
  if( (rDiff == 0) && (Math.abs(fDiff) == 1) ) return true;
  if( (Math.abs(fDiff) == 1) && (Math.abs(rDiff) == 1) ) return true;
  return false;
}

function validKnightMove() {
  // No blocking for knights
  const fDiff = move.startSquare.file - move.endSquare.file;
  const rDiff = move.startSquare.rank - move.endSquare.rank;
  if( (Math.abs(fDiff) == 1) && (Math.abs(rDiff) == 2) ) return true;
  if( (Math.abs(fDiff) == 2) && (Math.abs(rDiff) == 1) ) return true;
  return false;
}

function validBishopMove() {
  const fDiff = move.startSquare.file - move.endSquare.file;
  const rDiff = move.startSquare.rank - move.endSquare.rank;
  if( Math.abs(fDiff) != Math.abs(rDiff) ) 
    // Does not share diagonal
    return false;
  return !blockedMoveDiagonal(move.startSquare, move.endSquare );
}

function validRookMove() {
  if( move.startSquare.file == move.endSquare.file ) {
    return !blockedMoveFile(move.startSquare, move.endSquare );
  }
  if( move.startSquare.rank == move.startSquare.rank ) {
    return !blockedMoveRank(move.startSquare, move.endSquare );
  }
  return false
}

function validQueenMove() {
  if( validRookMove()) 
   return true;
  return validBishopMove();
}

function validPawnMove() {
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
        game.enPassant = index2alpha(file, rank+direction);
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
function identifyPiece() {

  const typeIndex = 'prnbqk'.indexOf(move.pieceType);
  const moveFunctions = [
    () => validPawnMove(),
    () => validRookMove(),
    () => validKnightMove(),
    () => validBishopMove(),
    () => validQueenMove(),
    () => validKingMove(),
 ];
   
  const colorType = move.WorB + move.pieceType;
  const candidates = document.querySelectorAll(`[data-group="${colorType}"]`);
  if( !candidates ) {
    console.log(`No pieces of type:${colorType} on board; move: ${move.notation}`);
    return;
  };
  
  for (const node of candidates) {
    const alpha = node.parentNode.id;
    move.startSquare.alpha = alpha;
    move.startSquare.file = fIndex[alpha[0]];
    move.startSquare.rank = rIndex[alpha[1]];
    
    funcIndex = "prnbqk".indexOf(move.pieceType);
    if( moveFunctions[funcIndex]() ) 
      return alpha;
  };
  move.startSquare = {};
  console.log("No match for move: " + `${move}`);
};

function moveCastle(notation) {
  // Handle special castling notation
  if (notation.includes("0-0-0")) {
    // Queen side castle
    // todo fix game.castling, apply rules.(not in/out of check)
    if( move.WorB == "b" ) {
      move.startSquare.alpha = "e8";
      move.endSquare.alpha = "c8";
      move.pieceType = "k";
      movePiece();
      move.startSquare.alpha = "a8";
      move.endSquare.alpha = "d8";
      move.pieceType = "r";
      movePiece();
    } else {
      move.startSquare.alpha = "e1";
      move.endSquare.alpha = "c1";
      move.pieceType = "k";
      movePiece();
      move.startSquare.alpha = "a1";
      move.endSquare.alpha = "d1";
      move.pieceType = "r";
      movePiece();
    }
    return;
  }
  if (notation.includes("0-0")) {
    // King side castle
    if( move.WorB == "b" ) {
      move.startSquare.alpha = "e8";
      move.endSquare.alpha = "g8";
      move.pieceType = "k";
      movePiece();
      move.startSquare.alpha = "h8";
      move.endSquare.alpha = "f8";
      move.pieceType = "r";
      movePiece();
    } else {
      move.startSquare.alpha = "e1";
      move.endSquare.alpha = "g1";
      move.pieceType = "k";
      movePiece();
      move.startSquare.alpha = "h1";
      move.endSquare.alpha = "f1";
      move.pieceType = "r";
      movePiece();
    }
  }
}

function parseMove(notation) {
  // enPassant option only lasts for a halfmove
  move.enPassant = game.enPassant;
  game.enPassant = '-';
  
  // Determine piece type
  if ('RNBQK'.includes(notation[0])) {
    move.pieceType = notation[0].toLowerCase();
    notation = notation.substring(1);
  } else {
    move.pieceType = 'p';
  }
  
  // endSquare
  const regex = /[a-h][1-8]/;
  let result = notation.match(regex);
  move.endSquare.alpha = result[0];
  // Compute to integers for eeasier comparions
  move.endSquare.file = fIndex[result[0][0]];
  move.endSquare.rank = rIndex[result[0][1]];

  if ( result.index != 0 ) {
   // Determine if move is ambiguous
   if ( '12345678abcdefgh'.includes(notation[0]) ) {
      move.disambiguate = notation[0];
    } else {
      move.disambiguate = '';
    }
  }
  // Determine if move is a capture
  move.captureMove = notation.includes('x');
  if ( move.captureMove )
    removePiece(move.endSquare.alpha); 

  notation = notation.substring(2 + result.index);
 
  // Determine if promotion
  if ('RNBQ'.includes(notation[0])) {
    move.promotionPiece = notation[0].toLowerCase();
    notation = notation.substring(1);
  }

//TODO set check + and mate states #
  move.checkResult = '+'.includes(notation[0]);
  move.mateResult = '#'.includes(notation[0]);

  return true;
}

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

async function transitionPiece() {
  removePiece(move.startSquare.alpha);

  // Focus transition piece
  const img = document.getElementById('transitionImage');
  const piece = move.WorB + move.pieceType;
  img.src = `/images/${gameTheme}/${piece}.png`;
  img.style.visibility = "visible";
  let x = move.startSquare.file * squareSize;
  let y = move.startSquare.rank * squareSize;
  img.top = y+"px";
  img.left = x+"px";

  x = (move.endSquare.file * squareSize) - x;
  y = (move.endSquare.rank * squareSize) - y;
  img.style.transform = `translate(${x}+"px", ${y}+"px" 2.0s ease-in-out)`;
  
  // Unfocus transition piece();
  img.style.visibility = "hidden";

  if( move.promotionPiece )
    move.pieceType = move.promotionPiece;
  placePiece( move.WorB + move.pieceType, move.endSquare.alpha);

/*todo needed?
  img.style.display = 'none';
  img.offsetHeight;
  img.style.display = '';
  */
}

function movePiece() {
  removePiece(move.startSquare.alpha);
  if( move.promotionPiece )
    move.pieceType = move.promotionPiece;
  placePiece( move.WorB + move.pieceType, move.endSquare.alpha);
};

function removePiece(square) {
  const container = document.getElementById(square);
  if( container ) container.replaceChildren();
};

function placePiece( piece, square) {

  // Move to new square
  let container = document.getElementById(square);
//fix   container.innerHTML += `<img class="piece" data-group="${piece}" src="/images/${gameTheme}/${piece}.png" alt="" >`;
const img = document.createElement('img');
img.src = `/images/${gameTheme}/${piece}.png`;
img.id = square+'-img';
img.className = 'piece'; // Assign a CSS class
img.setAttribute('data-group', `${piece}`);
container.appendChild(img);

  // Undo any previous check
  container = document.getElementById("checkSquare");
  container.style.visibility = "hidden";

  // Highlight checked King
  if( move.checkResult || move.mateResult ) { 
    container.style.visibility = "visible";
    const colorType = ((move.WorB=="w") ? "bk" : "wk");
    const king = document.querySelectorAll(`[data-group="${colorType}"]`)[0];
    let cell = alpha2index(king.id);
    container.style.left = (cell[0]*squareSize)+"px";
    container.style.top = (cell[1]*squareSize)+"px";
    if( move.mateResult ) {
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
  game.initalBoard = parts[0];
  move.WorB = parts[1];
  game.castling = parts[2];
  game.enPassant = parts[3];
  game.halfMoves = parts[4];
  game.fullMoves = parts[5];
  
  const ranks = parts[0].split("/");
  if (ranks.length != 8) {
    console.log(`Invalid FEN:${fen}`);
    return;
    }

  // Drop pieces from any previous game
  clearBoard();
  
  // Go thru the ranks 8 to 1
  let boardFiles ='abcdefgh';
  let boardRanks = '87654321';
  for (let rank = 0; rank < ranks.length; rank++) {
    let fileIndex = 0;
    let boardRank = boardRanks[rank];
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
        placePiece(piece, `${boardFiles[fileIndex]}${boardRank}` );
        fileIndex++;
      } else if(boardRanks.includes(p)) {
        // skips empty squares
        fileIndex += parseInt(p, 10);
      }
    }
  }
};

function squareTemplate(file, rank) {
  return `<div id="${file}${rank}" class='square file-${file} rank${rank}' >`+"</div>";
};

function defineSquares() {
  // Populate the global variables
  resizeBoard(window.innerWidth, window.innerHeight);

  // Define the squares, the pieces are added later
  const container = document.getElementById("board");

  // Add hidden square to highlight checks
  container.innerHTML += "<div id='checkSquare' class='checkSquare square file-a rank8'></div>"
  
  let boardFiles ='abcdefgh';
  let boardRanks = '87654321';  
  for (let rank = 0; rank < boardRanks.length; rank++) {
    for (let file = 0; file < boardFiles.length; file++) {
      container.innerHTML += squareTemplate(boardFiles[file],boardRanks[rank]);
    }
  }
};