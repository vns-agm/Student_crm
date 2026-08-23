/** Decorative looping chess animations for the login screen. */
export function ChessLoginScene() {
  return (
    <div className="chess-scene" aria-hidden="true">
      <div className="chess-scene-glow" />
      <div className="chess-board-stage">
        <svg
          className="chess-board-svg"
          viewBox="0 0 320 320"
          role="img"
          aria-label=""
        >
          <defs>
            <linearGradient id="darkSq" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1a4d3e" />
              <stop offset="100%" stopColor="#0f3329" />
            </linearGradient>
            <linearGradient id="lightSq" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e4efe6" />
              <stop offset="100%" stopColor="#c8dcc9" />
            </linearGradient>
            <filter id="pieceSoft" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="1.5"
                floodColor="#0a1f18"
                floodOpacity="0.35"
              />
            </filter>
          </defs>

          {Array.from({ length: 8 }, (_, row) =>
            Array.from({ length: 8 }, (_, col) => {
              const dark = (row + col) % 2 === 1
              return (
                <rect
                  key={`${row}-${col}`}
                  x={col * 40}
                  y={row * 40}
                  width={40}
                  height={40}
                  fill={dark ? 'url(#darkSq)' : 'url(#lightSq)'}
                />
              )
            }),
          )}

          <g className="piece piece-rook" filter="url(#pieceSoft)">
            <text x="20" y="292" textAnchor="middle" className="piece-glyph light">
              ♖
            </text>
          </g>
          <g className="piece piece-knight" filter="url(#pieceSoft)">
            <text x="60" y="292" textAnchor="middle" className="piece-glyph light">
              ♘
            </text>
          </g>
          <g className="piece piece-pawn" filter="url(#pieceSoft)">
            <text x="140" y="292" textAnchor="middle" className="piece-glyph light">
              ♙
            </text>
          </g>
          <g className="piece piece-bishop" filter="url(#pieceSoft)">
            <text x="100" y="132" textAnchor="middle" className="piece-glyph dark">
              ♝
            </text>
          </g>
          <g className="piece piece-queen" filter="url(#pieceSoft)">
            <text x="140" y="52" textAnchor="middle" className="piece-glyph dark">
              ♕
            </text>
          </g>
          <g className="piece piece-king" filter="url(#pieceSoft)">
            <text x="180" y="52" textAnchor="middle" className="piece-glyph dark">
              ♔
            </text>
          </g>
        </svg>

        <div className="move-trail move-trail-a" />
        <div className="move-trail move-trail-b" />
      </div>

      <div className="floating-pieces">
        <span className="float-piece fp1">♞</span>
        <span className="float-piece fp2">♟</span>
        <span className="float-piece fp3">♜</span>
        <span className="float-piece fp4">♝</span>
      </div>
    </div>
  )
}
