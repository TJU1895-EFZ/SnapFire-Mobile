export function OperatorArt(): React.JSX.Element {
  return (
    <svg
      className="operator-art"
      viewBox="0 0 560 820"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bodyDark" x1="160" y1="240" x2="400" y2="700" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1d2428" />
          <stop offset="0.55" stopColor="#111518" />
          <stop offset="1" stopColor="#07090a" />
        </linearGradient>
        <linearGradient id="vestGrad" x1="220" y1="240" x2="350" y2="410" gradientUnits="userSpaceOnUse">
          <stop stopColor="#293136" />
          <stop offset="0.6" stopColor="#171c1f" />
          <stop offset="1" stopColor="#0c0f10" />
        </linearGradient>
        <linearGradient id="helmetGrad" x1="230" y1="90" x2="330" y2="170" gradientUnits="userSpaceOnUse">
          <stop stopColor="#30393e" />
          <stop offset="0.55" stopColor="#171c1f" />
          <stop offset="1" stopColor="#0a0c0d" />
        </linearGradient>
        <linearGradient id="rifleGrad" x1="170" y1="420" x2="480" y2="290" gradientUnits="userSpaceOnUse">
          <stop stopColor="#242a2e" />
          <stop offset="0.5" stopColor="#14181a" />
          <stop offset="1" stopColor="#080a0b" />
        </linearGradient>
        <linearGradient id="visorGrad" x1="240" y1="145" x2="322" y2="150" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff7a18" />
          <stop offset="0.5" stopColor="#ffc46a" />
          <stop offset="1" stopColor="#ff4d00" />
        </linearGradient>
        <linearGradient id="rimAmber" x1="280" y1="80" x2="430" y2="760" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffd089" />
          <stop offset="0.45" stopColor="#ff9d2e" />
          <stop offset="1" stopColor="#ff6a00" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="rimCyan" x1="280" y1="90" x2="140" y2="720" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9be7ff" />
          <stop offset="0.5" stopColor="#3aa8d8" />
          <stop offset="1" stopColor="#1a6c96" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="backGlow" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#ff9d2e" stopOpacity="0.24" />
          <stop offset="0.55" stopColor="#ff7a18" stopOpacity="0.08" />
          <stop offset="1" stopColor="#ff7a18" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="floorShadow" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#000000" stopOpacity="0.85" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="softBlur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="40" />
        </filter>
        <filter id="visorGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="300" cy="350" rx="250" ry="300" fill="url(#backGlow)" filter="url(#softBlur)" />
      <ellipse cx="285" cy="762" rx="180" ry="34" fill="url(#floorShadow)" />

      <g className="operator-figure">
        {/* Legs */}
        <path
          d="M205 424 L272 424 L268 556 L258 704 L192 704 L198 556 Z"
          fill="url(#bodyDark)"
          stroke="#252c30"
          strokeWidth="1.5"
        />
        <path
          d="M290 424 L356 424 L372 556 L388 704 L322 704 L296 556 Z"
          fill="url(#bodyDark)"
          stroke="#252c30"
          strokeWidth="1.5"
        />
        <path d="M219 472 L252 472 L249 508 L216 508 Z" fill="#14191c" stroke="#2b3338" />
        <path d="M307 478 L342 478 L345 514 L310 514 Z" fill="#14191c" stroke="#2b3338" />
        <path d="M204 556 L266 556 L262 598 L201 598 Z" fill="#1a2024" stroke="#2e373c" />
        <path d="M298 556 L362 556 L368 600 L302 600 Z" fill="#1a2024" stroke="#2e373c" />
        {/* Boots */}
        <path
          d="M192 700 L262 700 L266 742 L270 764 L160 764 L164 738 Z"
          fill="#0d1012"
          stroke="#2a3236"
          strokeWidth="1.5"
        />
        <path
          d="M318 700 L388 700 L396 738 L402 764 L294 764 L298 742 Z"
          fill="#0d1012"
          stroke="#2a3236"
          strokeWidth="1.5"
        />
        <path d="M166 750 L266 750 L268 758 L164 758 Z" fill="#252b2e" />
        <path d="M298 750 L398 750 L400 758 L296 758 Z" fill="#252b2e" />

        {/* Torso base */}
        <path
          d="M194 236 Q280 204 371 236 L361 421 Q280 448 203 421 Z"
          fill="url(#bodyDark)"
          stroke="#2b3338"
          strokeWidth="1.5"
        />
        {/* Vest */}
        <path
          d="M211 247 Q280 226 354 247 L347 399 Q280 420 213 399 Z"
          fill="url(#vestGrad)"
          stroke="#39434a"
          strokeWidth="1.5"
        />
        <path
          d="M215 258 Q280 240 350 258 L346 302 Q280 320 214 302 Z"
          fill="#20272b"
          stroke="#434e55"
          strokeWidth="1"
        />
        {/* Pouches */}
        <path d="M226 306 L258 300 L262 349 L230 355 Z" fill="#1a2024" stroke="#3d474d" />
        <path d="M268 299 L300 294 L303 344 L271 349 Z" fill="#1a2024" stroke="#3d474d" />
        <path d="M310 294 L340 290 L344 339 L314 344 Z" fill="#1a2024" stroke="#3d474d" />
        <path d="M230 314 L257 309 L259 320 L232 325 Z" fill="#2c353a" />
        <path d="M272 307 L297 303 L299 314 L274 318 Z" fill="#2c353a" />
        <path d="M314 302 L338 299 L340 310 L316 313 Z" fill="#2c353a" />
        {/* Radio + antenna */}
        <path d="M344 262 L360 259 L363 290 L347 293 Z" fill="#111619" stroke="#3a444a" />
        <path d="M354 259 L356 220" stroke="#4d5a61" strokeWidth="2.5" />
        <path d="M351 264 L358 263 L359 272 L352 273 Z" fill="#ff9d2e" opacity="0.8" />
        {/* Straps */}
        <path d="M222 252 L262 292 L258 304 L216 264 Z" fill="#101416" opacity="0.9" />
        <path d="M348 252 L308 292 L312 304 L352 264 Z" fill="#101416" opacity="0.9" />
        <path d="M214 334 L347 334 L345 346 L216 346 Z" fill="#0f1315" opacity="0.85" />
        {/* Patch */}
        <path d="M315 268 L338 264 L340 278 L317 282 Z" fill="#ff9d2e" opacity="0.85" />
        <path d="M319 271 L334 269 L335 274 L320 276 Z" fill="#111518" />
        {/* Belt */}
        <path d="M205 398 L351 398 L349 424 L207 424 Z" fill="#101416" stroke="#333c41" />
        <path d="M269 401 L290 401 L289 421 L270 421 Z" fill="#3b464c" />
        <path d="M274 405 L285 405 L284 417 L275 417 Z" fill="#0c0f10" />
        {/* Shoulder pads */}
        <path
          d="M154 250 Q196 212 228 246 L222 291 Q190 304 159 281 Z"
          fill="#20272b"
          stroke="#3b464c"
          strokeWidth="1.5"
        />
        <path
          d="M409 250 Q367 212 335 246 L341 291 Q373 304 404 281 Z"
          fill="#20272b"
          stroke="#3b464c"
          strokeWidth="1.5"
        />
        {/* Neck */}
        <path d="M250 190 L310 190 L305 237 L255 237 Z" fill="#111619" stroke="#2c3439" />

        {/* Head + helmet */}
        <path
          d="M237 143 Q280 120 323 143 L320 196 Q280 216 240 196 Z"
          fill="#151a1d"
          stroke="#30393e"
          strokeWidth="1.5"
        />
        <path
          d="M224 144 Q230 88 280 80 Q330 88 336 144 L331 161 L229 161 Z"
          fill="url(#helmetGrad)"
          stroke="#3b464c"
          strokeWidth="1.5"
        />
        <path d="M229 158 L331 158 L333 168 L227 168 Z" fill="#101416" stroke="#3a444a" />
        <path d="M236 104 Q280 82 324 104" stroke="#4b585f" strokeWidth="2" opacity="0.8" />
        {/* NVG mount */}
        <path d="M267 82 L293 82 L293 96 L267 96 Z" fill="#111619" stroke="#4a565d" />
        <path d="M271 74 L289 74 L289 84 L271 84 Z" fill="#20272b" stroke="#4a565d" />
        <path d="M279 68 L281 75" stroke="#5a676e" strokeWidth="2" />
        {/* Visor */}
        <path
          d="M238 142 Q280 127 322 142 L320 157 Q280 169 240 157 Z"
          fill="url(#visorGrad)"
          filter="url(#visorGlow)"
          opacity="0.95"
        />
        <path d="M243 145 Q280 133 316 145" stroke="#fff4dd" strokeWidth="1.4" opacity="0.8" />
        {/* Mask grille */}
        <path d="M260 177 L300 177 L298 196 Q280 203 262 196 Z" fill="#0c0f10" stroke="#30393e" />
        <path d="M266 182 L294 182" stroke="#3d474d" strokeWidth="2" />
        <path d="M266 188 L294 188" stroke="#3d474d" strokeWidth="2" />
        <path d="M267 194 L293 194" stroke="#3d474d" strokeWidth="2" />

        {/* Left arm */}
        <path
          d="M163 256 L204 272 L183 345 L143 333 Z"
          fill="#1b2125"
          stroke="#333d42"
          strokeWidth="1.5"
        />
        <path
          d="M143 333 L183 345 L226 386 L207 410 L165 377 Z"
          fill="#20272b"
          stroke="#39444a"
          strokeWidth="1.5"
        />
        <path d="M165 352 L188 361 L178 378 L157 369 Z" fill="#151a1d" stroke="#343e43" />
        {/* Right arm */}
        <path
          d="M397 256 L356 272 L377 348 L417 334 Z"
          fill="#1b2125"
          stroke="#333d42"
          strokeWidth="1.5"
        />
        <path
          d="M417 334 L377 348 L334 370 L346 400 L389 378 Z"
          fill="#20272b"
          stroke="#39444a"
          strokeWidth="1.5"
        />
        <path d="M395 354 L372 364 L382 382 L403 372 Z" fill="#151a1d" stroke="#343e43" />

        {/* Rifle shadow/edge */}
        <g transform="translate(4 5)" opacity="0.55">
          <path d="M104 443 L162 415 L178 438 L124 468 Z" fill="#050607" />
          <path d="M164 407 L336 334 L354 372 L182 443 Z" fill="#050607" />
          <path d="M334 334 L426 299 L442 330 L352 367 Z" fill="#050607" />
          <path d="M424 299 L486 277 L492 292 L440 314 Z" fill="#050607" />
        </g>
        {/* Rifle */}
        <path d="M104 439 L162 411 L178 434 L124 464 Z" fill="#14181a" stroke="#3a444a" />
        <path d="M164 403 L336 330 L354 368 L182 439 Z" fill="url(#rifleGrad)" stroke="#414c52" strokeWidth="1.5" />
        <path d="M334 330 L426 295 L442 326 L352 363 Z" fill="#171c1f" stroke="#414c52" strokeWidth="1.5" />
        <path d="M424 295 L486 273 L492 288 L440 310 Z" fill="#0d1012" stroke="#39444a" />
        <path d="M486 271 L502 265 L506 278 L492 284 Z" fill="#090b0c" stroke="#4a565d" />
        <path d="M352 338 L430 306" stroke="#ff9d2e" strokeWidth="2" opacity="0.65" />
        <path d="M196 421 L224 408 L240 468 L210 481 Z" fill="#121619" stroke="#3c464c" />
        <path d="M252 398 L288 382 L314 444 L278 461 Z" fill="#121619" stroke="#3c464c" />
        <path d="M258 407 L282 396 L300 438 L276 449 Z" fill="#1d2428" />
        {/* Optic */}
        <path d="M282 315 L334 294 L344 314 L292 335 Z" fill="#0f1315" stroke="#4a565d" />
        <path d="M298 308 L328 296 L333 306 L303 318 Z" fill="#1d2428" stroke="#5a676e" />
        <circle cx="315" cy="307" r="2.6" fill="#ff4d2e" filter="url(#glow)" />
        <path d="M338 300 L352 294 L356 302 L342 308 Z" fill="#20272b" stroke="#4a565d" />
        {/* Rails / detail */}
        <path d="M370 320 L404 306 L408 314 L374 328 Z" fill="#0d1012" stroke="#3a444a" />
        <path d="M204 391 L228 381 L231 389 L207 399 Z" fill="#ff9d2e" opacity="0.55" />

        {/* Hands / gloves */}
        <path
          d="M205 375 Q232 366 244 386 L232 407 Q209 416 197 398 Z"
          fill="#0d1012"
          stroke="#3a444a"
          strokeWidth="1.5"
        />
        <path d="M214 382 L230 376 M210 390 L228 383 M207 398 L225 391" stroke="#2d363b" strokeWidth="2" />
        <path
          d="M318 356 Q346 346 356 365 L342 388 Q317 396 307 378 Z"
          fill="#0d1012"
          stroke="#3a444a"
          strokeWidth="1.5"
        />
        <path d="M327 364 L342 357 M323 372 L340 365 M319 380 L337 373" stroke="#2d363b" strokeWidth="2" />

        {/* Rim highlights */}
        <path
          d="M334 145 Q330 92 284 82"
          stroke="url(#rimAmber)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#glow)"
        />
        <path
          d="M404 260 L365 420"
          stroke="url(#rimAmber)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#glow)"
          opacity="0.9"
        />
        <path
          d="M356 430 L388 704"
          stroke="url(#rimAmber)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#glow)"
          opacity="0.8"
        />
        <path
          d="M440 314 L486 292"
          stroke="url(#rimAmber)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#glow)"
        />
        <path
          d="M226 146 Q230 94 276 83"
          stroke="url(#rimCyan)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#glow)"
          opacity="0.85"
        />
        <path
          d="M156 252 L205 420"
          stroke="url(#rimCyan)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#glow)"
          opacity="0.65"
        />
        <path
          d="M204 430 L192 704"
          stroke="url(#rimCyan)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#glow)"
          opacity="0.55"
        />
      </g>

      {/* Floating dust specks */}
      <g fill="#ffbd6a" opacity="0.55">
        <circle cx="118" cy="300" r="1.6" />
        <circle cx="452" cy="246" r="1.3" />
        <circle cx="478" cy="430" r="1.8" />
        <circle cx="96" cy="514" r="1.2" />
        <circle cx="430" cy="600" r="1.4" />
        <circle cx="150" cy="640" r="1" />
      </g>
    </svg>
  )
}
