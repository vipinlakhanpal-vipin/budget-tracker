// Launch splash screen -- shown for 6 seconds every time the app starts
// (both a fresh browser load and opening the installed PWA/home screen
// icon), then fades out on its own. Built around the app's own name: a
// literal hearth -- a warm flame glowing at the center of a roofline --
// with a small cast of budgeting-related characters (a coin, a rising
// trend line, a wallet, a piggy bank, a receipt) gently floating around
// it, plus embers and AI "sparkle" stars drifting up so the whole scene
// feels alive rather than a static logo. Purely cosmetic: it doesn't gate
// anything, the real app underneath is already mounting while it plays.
//
// Two things layered behind the original hearth scene:
// 1. A real vector world map (WORLD_MAP_PATH below) -- actual country
//    outlines, not a hand-built dot grid or smooth blobs, sourced from a
//    CC0/public-domain low-resolution world boundary dataset and reduced
//    to ~200 lightweight polygon outlines (arc-length sampled from the
//    original country paths, then re-split wherever two sample points
//    landed implausibly far apart, so a country's disconnected islands
//    don't get bridged by a stray straight line across open ocean). Small
//    enough to inline directly as one <path>, no image request needed.
// 2. A red, blinking location dot + "City, Country" label, placed using a
//    real IP-based lookup (no permission prompt needed, unlike the
//    browser's own geolocation API). Positioned by looking up the
//    resolved ISO country code directly in COUNTRY_CENTROIDS -- the
//    centroid of that same country's own polygon in this exact map, not a
//    separately-computed lat/lon projection -- so the dot is guaranteed to
//    land inside the correct country's shape rather than possibly missing
//    it due to any lat/lon-to-pixel mismatch. Fails silently if the lookup
//    is blocked/offline or the country isn't in the table: the map still
//    looks complete either way, there's just no dot.
import { useEffect, useState } from 'react';
import { formatVersionBadge } from '../version.js';

// Free, no-API-key IP geolocation lookup with CORS enabled for browser
// fetches -- confirmed working live before wiring this in. Deliberately
// not the browser's own navigator.geolocation: that pops a permission
// prompt on every single app launch, which would be intrusive for a purely
// decorative splash detail.
const GEO_LOOKUP_URL = 'https://ipapi.co/json/';

// The world map's own coordinate space (matches the source dataset's
// viewBox exactly) -- WORLD_MAP_PATH and every entry in COUNTRY_CENTROIDS
// are both expressed in these same units, so a centroid always lands
// exactly inside its country's own polygon with no separate projection
// math required.
const WORLD_MAP_VIEWBOX = '30 241 784 459';

// ~200 country polygons flattened into one path (see file header for how
// this was derived). Deliberately faceted/low-poly rather than perfectly
// smooth coastlines -- it reads clearly as a world map at the small size
// this renders at, and the geometric style fits the flat illustration
// look of the rest of the splash.
const WORLD_MAP_PATH =
  'M513 503L519 504L526 503L525 509L517 508L513 503ZM528 468L533 472L538 469L540 463L535 467L528 468ZM546 435L551 448L558 453L568 443L572 430L569 428L558 429L546 435ZM451 420L451 424L453 426L454 423L453 420L451 420ZM507 421L510 424L510 427L506 426L504 422L507 421ZM437 547L437 565L446 574L460 573L463 559L453 552L437 547ZM436 544L437 546L438 545L439 543L437 543L436 544ZM279 601L272 616L277 633L268 645L261 659L260 675L252 677L250 659L246 640L245 622L244 604L254 592L270 599L279 601ZM265 688L265 692L268 692L272 690L268 689L265 688ZM430 403L435 406L441 405L442 400L437 402L430 403ZM673 609L669 635L694 633L715 640L723 651L743 660L760 639L766 614L758 590L751 571L738 585L728 569L711 577L691 591L673 609ZM729 668L727 675L730 678L735 674L735 670L729 668ZM509 419L511 424L516 427L519 423L515 420L509 419ZM443 411L445 414L448 418L450 414L447 411L443 411ZM616 458L618 467L624 470L627 469L624 462L616 458ZM414 392L415 394L419 397L421 395L418 393L414 392ZM404 493L412 499L406 504L398 506L396 500L404 493ZM457 414L458 421L465 421L468 416L464 415L457 414ZM479 538L481 538L482 540L480 542L479 541L479 538ZM412 515L414 510L416 504L412 502L411 508L412 515ZM689 515L688 517L687 518L689 519L690 517L689 515ZM239 561L249 564L262 572L267 583L257 591L244 591L241 577L239 561ZM287 618L297 596L313 579L322 558L309 540L283 533L275 526L258 521L246 532L236 544L236 557L255 566L268 583L281 601L287 618ZM222 463L224 467L228 469L226 464L224 460L226 461ZM616 454L618 455L621 455L622 453L619 453L616 454ZM455 595L462 597L473 590L468 579L458 582L455 595ZM456 383L461 388L472 389L473 379L463 376L456 383ZM192 483L192 486L193 485L194 483L194 482L192 483ZM152 281L191 297L226 312L241 305L252 326L222 355L248 368L276 358L274 390L270 407L238 407L205 385ZM186 286L212 266L223 256L263 270ZM208 304L237 288L245 274L248 299ZM273 346L275 307L282 276L274 254L265 274ZM438 547L452 552L461 558L477 564L476 554L478 541L484 525L469 520L454 519L448 535L438 547ZM443 519L456 519L472 519L464 508L453 510L443 519ZM439 527L444 539L435 543L446 538L451 524L439 527ZM424 403L420 407L424 408L428 408L428 405L424 403ZM388 522L399 519L399 511L392 505L386 511L388 522ZM261 684L263 685L247 680L244 662L241 642L240 619L239 596L242 590L243 609L245 632L248 655L251 678L242 650ZM428 519L439 526L442 518L443 505L438 509L428 519ZM594 386L581 415L590 438L619 453L641 464L669 470L692 443L686 414L682 411L698 384L677 368L657 376L654 396L622 405L594 386ZM672 473L669 474L669 477L672 477L674 474L672 473ZM234 498L221 507L218 522L222 533L234 540L237 534L241 522L231 512L234 498ZM203 503L205 507L202 509L199 506L198 502L203 503ZM206 470L215 471L221 478L227 475L217 469L206 470ZM350 490L350 492L353 494L355 493L352 497L352 495ZM485 438L484 440L482 442L480 440L482 439L485 438ZM437 399L443 400L446 396L440 393L435 395L437 399ZM422 384L435 382L436 393L432 403L423 397L422 384ZM427 370L424 379L429 375L429 380L432 380L432 376ZM509 500L509 503L512 503L512 500L511 498L509 500ZM256 485L256 487L256 488L257 488L257 487L256 485ZM242 482L238 479L235 479L235 483L239 483L242 482ZM425 436L411 437L404 446L397 454L387 462L399 470L410 479L423 481L434 472L429 462L427 448L425 436ZM214 529L209 536L211 544L218 541L222 534L214 529ZM184 531L183 534L182 536L184 535L185 533L184 531ZM463 363L458 363L455 366L459 369L463 368L463 363ZM452 364L453 365L452 364L450 368L453 368L453 366ZM466 449L484 450L483 453L490 468L478 475L466 468L466 449ZM496 494L498 486L502 491L509 497L504 495L496 494ZM403 416L387 418L391 430L402 436L411 423L403 416ZM374 458L374 460L368 459L369 461L364 458L365 460L366 458ZM412 428L415 428L414 427ZM490 509L496 495L508 499L516 508L520 514L508 521L495 518L490 509ZM453 340L449 355L462 358L465 344L460 327L448 328L453 340ZM281 678L277 680L281 679L281 681L284 681L283 677ZM413 394L401 400L406 408L411 418L424 415L422 403L413 394ZM276 517L280 520L280 523L278 527L275 524L275 520ZM538 587L540 589L518 564L517 563ZM435 527L428 533L434 541L438 536L443 531L435 527ZM401 368L406 383L404 394L399 392L397 380L401 368ZM394 379L391 379L391 382L394 383L396 381L394 379ZM495 416L499 420L505 421L506 418L501 416L495 416ZM399 513L404 519L408 513L408 505L400 505L399 513ZM293 282L312 302L318 321L312 352L331 348L359 333L365 312L382 297L389 275L370 276L373 267L344 264L327 270L303 275L293 282ZM311 319L312 323L309 321ZM371 313L374 316L371 316L370 313ZM367 497L369 498L372 498L373 496L370 497L367 497ZM370 505L377 506L384 511L386 503L377 501L370 505ZM427 522L428 524L428 522L433 528L434 527L431 527ZM453 427L455 433L461 431L461 425L463 422L453 427ZM462 438L464 439L467 439L466 441L463 441L462 438ZM183 491L189 494L194 488L191 483L187 485L183 491ZM368 502L370 505L372 503L372 501L370 500L368 502ZM261 511L267 517L268 525L262 528L260 519L261 511ZM194 489L202 488L202 491L196 496L194 494L194 489ZM443 408L437 413L443 417L445 415L446 410L443 408ZM232 477L235 480L232 483L229 482L232 481L232 477ZM444 403L446 408L452 406L457 402L451 403L444 403ZM640 514L659 545L649 522ZM704 544L706 529L698 540L724 538ZM680 552L700 562L713 558L740 547L751 543ZM687 528L686 541L691 520ZM395 383L391 389L384 390L386 384L390 379L395 383ZM486 445L485 449L486 453L488 451L489 447L486 445ZM595 510L601 491L614 475L616 457L627 468L633 449L618 456L602 456L589 442L580 441L573 457L571 468L581 471L586 491L595 510ZM503 434L496 446L509 453L520 452L510 441L503 434ZM507 428L511 440L520 451L531 460L543 463L555 459L550 448L545 436L534 429L520 431L507 428ZM366 341L363 346L370 352L380 347L373 342L366 341ZM423 409L431 418L442 427L447 426L437 417L435 407L423 409ZM441 432L435 433L441 436L426 425L428 429L428 424ZM222 481L219 481L219 483L221 483L223 482L222 481ZM489 447L488 454L491 455L494 450L495 446L489 447ZM709 426L711 426L711 421L722 425L729 408L724 403L717 417L721 396L731 388L732 380L736 373ZM491 521L492 534L504 541L506 528L502 523L491 521ZM565 411L571 418L569 421L580 416L575 410L565 411ZM655 498L661 500L665 493L662 491L655 491L655 498ZM514 560L515 561L516 562L517 560L516 560L514 560ZM688 407L693 413L695 405L698 397L693 401L688 407ZM696 410L702 415L702 422L697 422L695 416L696 410ZM519 453L517 452L516 455L518 456L519 456L519 453ZM513 402L517 410L531 418L537 406L553 413L568 411L584 410L587 393L587 384L570 377L554 373L536 377L531 391L513 388L513 402ZM651 466L650 478L659 483L666 487L656 476L651 466ZM487 440L487 443L487 444L489 444L489 441L487 440ZM259 493L258 495L259 496L260 495L260 494L259 493ZM603 505L603 510L604 514L608 512L607 507L603 505ZM378 515L383 518L388 521L386 515L382 511L378 515ZM471 607L474 605L476 607L474 609L471 610L471 607ZM452 375L453 378L456 382L462 379L459 376L452 375ZM420 398L422 398L422 397L422 396L421 396L420 398ZM463 370L456 371L450 371L454 375L462 376L463 370ZM430 454L442 448L453 450L465 449L466 466L464 481L449 473L434 468L430 454ZM403 440L391 444L383 455L373 465L365 477L375 473L382 466L388 457L399 449L403 440ZM465 401L467 405L469 408L471 404L468 401L465 401ZM450 417L449 418L449 420L451 419L451 418L450 417ZM527 561L518 572L513 585L516 597L523 586L528 573L527 561ZM457 419L454 420L454 422L456 423L458 421L457 419ZM378 495L393 493L393 478L398 471L411 481L414 492L399 497L387 505L378 495ZM646 502L640 485L630 477L630 460L638 457L647 470L643 484L646 502ZM597 386L612 383L620 374L636 378L652 375L663 382L656 393L642 405L625 406L609 399L597 386ZM365 478L369 489L383 492L393 486L391 469L387 466L377 473L365 478ZM441 438L439 439L439 440L441 441L441 440L441 438ZM545 584L544 586L544 587L545 586L546 585L545 584ZM582 516L584 519L584 522L586 523L584 528L585 527ZM488 567L491 575L494 568L491 560L488 558L488 567ZM134 434L137 452L144 458L140 439L146 450L154 468L164 484L181 489L193 481L192 473L177 478L176 459L166 448L152 439L134 434ZM648 512L650 520L657 527L659 522L655 515L648 512ZM676 527L688 527L696 518L691 511L685 519L676 527ZM483 596L491 585L504 573L502 560L495 569L487 567L487 578L483 596ZM444 604L453 599L457 585L466 577L451 575L435 575L441 589L444 604ZM799 603L800 606L803 610L805 609L802 606L799 603ZM413 500L427 499L440 494L445 480L435 472L423 482L416 493L413 500ZM414 515L426 520L436 512L441 499L427 500L417 502L414 515ZM203 492L205 497L202 502L197 500L198 495L203 492ZM421 385L418 388L416 389L418 392L421 390L421 385ZM461 327L453 321L442 325L432 338L425 347L418 362L428 364L432 355L436 338L449 328L461 327ZM437 286L431 290L439 291L445 287L442 283L445 290ZM595 449L600 455L609 456L612 453L603 450L595 449ZM804 656L804 670L800 682L810 676L809 666L796 680L790 691L780 698L771 694L784 688L795 678ZM532 482L540 473L542 468L548 476L541 486L532 482ZM206 507L209 512L214 508L220 509L213 506L206 507ZM210 541L213 555L221 570L234 580L241 571L235 557L228 548L229 539L220 540L210 541ZM752 540L752 559L764 559L773 564L766 550L752 540ZM778 546L772 550L777 551L776 542L781 547L776 541ZM697 496L704 495L708 499L713 502L714 512L697 481L704 487L700 490ZM554 455L558 463L572 466L574 456L581 442L585 434L572 431L567 446L554 455ZM457 390L451 397L440 392L440 382L452 381L457 390ZM249 482L247 481L245 482L247 484L249 484L249 482ZM388 422L387 429L386 435L390 433L391 425L388 422ZM368 443L368 444L338 428L344 428L344 432L350 434L350 433ZM267 584L275 592L276 604L270 598L258 592L267 584ZM527 463L527 466L528 467L530 466L530 463L527 463ZM458 401L454 409L463 415L472 412L467 405L458 401ZM452 407L450 411L451 417L456 418L456 413L452 407ZM545 323L505 324L483 334ZM497 271L515 290L513 295L507 317ZM652 248L653 251L658 263ZM705 345L721 378L707 347ZM480 533L482 535L482 538L479 538L478 535L480 533ZM520 458L528 470L539 476L526 483L514 486L505 481L497 470L488 458L494 449L507 453L520 458ZM784 550L789 555L792 562L794 558L799 569L796 571ZM536 549L538 550L542 543L544 542L544 548L544 546ZM466 505L464 492L467 478L481 476L494 476L495 490L491 505L480 506L466 505ZM445 330L450 342L441 355L441 369L434 375L433 359L436 343L445 330ZM446 369L444 370L445 372L446 372L447 371L446 369ZM658 528L659 528L661 528L660 527L659 527L658 528ZM443 405L439 407L437 408L439 410L442 408L443 405ZM444 401L448 402L454 401L454 398L448 398L444 401ZM373 510L376 513L379 513L380 509L377 507L373 510ZM372 499L370 500L380 499L373 490L366 496L372 499ZM527 502L530 511L521 523L510 534L509 523L521 514L527 502ZM268 517L274 517L274 522L270 527L267 522L268 517ZM489 508L492 518L479 519L467 511L477 507L489 508ZM422 531L424 531L422 531L425 527L425 529L424 527ZM189 495L192 496L193 496L193 494L191 493L189 495ZM488 437L490 445L497 444L502 436L495 434L488 437ZM483 597L480 598L480 601L483 601L485 599L483 597ZM441 495L446 480L452 476L464 485L461 500L453 510L443 506L441 495ZM408 517L411 513L411 507L408 506L408 511L408 517ZM646 473L659 484L654 497L649 506L646 509L644 490L646 473ZM560 422L564 422L575 423L572 428L565 427L560 422ZM528 419L527 429L538 429L551 435L553 425L541 416L528 419ZM426 436L431 438L434 445L430 453L426 445L426 436ZM473 422L469 425L470 437L488 436L506 431L494 422L473 422ZM259 503L257 504L258 505L259 506L260 504L259 503ZM696 454L693 457L693 461L696 463L696 458L696 454ZM492 560L506 558L503 544L492 535L482 540L482 552L492 560ZM461 389L461 401L470 408L480 412L484 405L491 393L476 386L461 389ZM480 532L487 533L492 527L488 522L484 525L480 532ZM144 376L130 398L132 427L156 439L172 455L195 449L212 457L221 442L240 422L260 405L240 407L226 404L205 386L174 381L144 376ZM89 283L83 301L87 323L67 334L97 322L113 318L131 337L138 346L128 320L145 291L134 267L103 266L95 278ZM275 612L273 620L277 626L284 622L282 617L275 612ZM559 428L564 417L564 414L551 411L535 407L532 418L545 419L559 428ZM259 497L258 498L260 498L257 500L258 501L258 500ZM232 504L240 502L255 505L258 518L250 525L243 528L238 514L232 504ZM659 502L671 497L663 481L659 465L657 473L666 487L659 502ZM811 582L811 586L811 583L813 588L813 599L813 597ZM509 489L516 498L529 493L532 483L521 487L509 489ZM533 498L535 500L537 499L538 498L536 498L533 498ZM477 588L461 599L454 604L449 613L459 620L478 612L479 601L475 604L473 604ZM460 572L474 575L487 565L480 553L480 565L466 561L460 572ZM469 578L476 587L485 585L486 574L476 573L469 578Z';

// Country centroids in the exact same coordinate space as WORLD_MAP_PATH
// above -- keyed by lowercase ISO 3166-1 alpha-2 code (what ipapi.co's
// `country_code` field returns), computed as each country polygon's own
// bounding-box center in this map. Looking a resolved country up here
// (rather than re-projecting its lat/lon separately) guarantees the red
// dot always lands inside that country's own shape on this exact map.
// Short-form overrides for country names in the "City, Country" label --
// ipapi.co's full country_name ("United Arab Emirates") reads long next to
// a city name at the small splash label size, so known short forms are
// swapped in here (falls back to the full name for anything not listed).
const COUNTRY_SHORT_NAMES = { ae: 'UAE' };

const COUNTRY_CENTROIDS = JSON.parse('{"_somaliland":[519.8,505.8],"ae":[534.4,467.2],"af":[560.8,439.9],"al":[452.4,422.7],"am":[507.7,424],"ao":[449.8,559.4],"ar":[261.6,642],"at":[436.7,403.1],"au":[718.5,623.6],"az":[513.7,423.1],"ba":[446.4,414.3],"bd":[621.1,465.3],"be":[417.2,394.4],"bf":[403.5,499.7],"bg":[463,417.7],"bi":[480.3,540.3],"bj":[412.9,508.1],"bn":[688.1,516.9],"bo":[253.6,576.1],"br":[275,569.3],"bs":[225.4,463.8],"bt":[619,454.2],"bw":[465.2,588.7],"by":[465.6,382.6],"bz":[193.4,484.1],"ca":[218.9,333.3],"cd":[460.8,542.2],"cf":[458.6,513.8],"cg":[443.2,533.2],"ch":[424.9,406],"ci":[393.3,513.4],"cl":[251.2,636.9],"cm":[437.6,512.8],"cn":[635.1,419.2],"co":[228,520.7],"cr":[201.1,506.3],"cu":[217.4,473.4],"cv":[352,493.9],"cy":[482.6,439.7],"cz":[440.3,396.6],"de":[429.8,392.7],"dk":[428.4,375.5],"dj":[510.2,500.1],"dm":[256.5,486.8],"do":[238.4,481],"dz":[411.4,458.9],"ec":[202,537.2],"ee":[456.5,366.2],"eg":[478.6,461.9],"er":[503.1,491.9],"es":[389.4,437.9],"et":[505.9,508.5],"fi":[457.1,342.9],"fk":[281.3,679.7],"fr":[397,491.3],"ga":[435.1,534.3],"gb":[400.6,382],"ge":[501.7,417.6],"gh":[403.4,511.7],"gl":[342.1,312.7],"gm":[369.8,497],"gn":[378.1,506.2],"gq":[430.7,525],"gr":[460.2,430.8],"gt":[188.6,488.7],"gw":[370.5,502.6],"gy":[263.3,520.1],"hn":[198.3,493.3],"hr":[442.8,413.3],"ht":[231.7,480.5],"hu":[450.1,404.2],"id":[695.3,537.9],"ie":[389.1,384.8],"il":[486.9,449.7],"in":[601.9,472.6],"iq":[507.9,443.8],"ir":[530.8,445],"is":[370.3,346],"it":[435.3,420.7],"jm":[220.9,482.1],"jo":[491.4,450.5],"jp":[723.1,403.7],"ke":[499.6,530],"kg":[573.7,415.4],"kh":[660.1,495.5],"km":[515.7,560.7],"kp":[692.6,404.3],"kr":[698.2,417.4],"kw":[517.6,454.4],"kz":[550.6,394.4],"la":[656.4,478.6],"lb":[487.8,442.3],"lc":[259.3,494.5],"lk":[605.2,509.7],"lr":[382.9,516],"ls":[473.2,607.5],"lt":[456.1,378.7],"lu":[421.3,397],"lv":[457.4,372.3],"ly":[447.9,463.3],"ma":[384.6,458.7],"md":[468,403.9],"me":[449.9,418.3],"mg":[520.8,579.2],"mk":[455.9,421.1],"ml":[397.3,486.9],"mm":[636.8,476],"mn":[631.7,389.5],"mr":[379.8,478.6],"mt":[440.3,439.5],"mu":[545.1,585.8],"mv":[584.2,522.4],"mw":[491.2,565.5],"mx":[166.7,462.1],"my":[673.5,519.7],"mz":[493.8,578.7],"na":[450.7,590.3],"nc":[801.6,606.6],"ne":[427,485.9],"ng":[427.6,508.8],"ni":[200.4,496.9],"nl":[418.3,388.8],"no":[439.6,324.5],"np":[604.5,452.2],"nz":[791.8,678],"om":[540.7,476.7],"pa":[212.2,508.7],"pe":[224.3,558],"pg":[766.6,554.2],"ph":[704.2,494.1],"pk":[569,447.7],"pl":[447.9,388.7],"pr":[247.2,482.6],"pt":[363.7,433.8],"py":[268.3,594.7],"qa":[528.3,464.9],"ro":[462.4,408],"rs":[452.6,413.3],"ru":[619.3,330.7],"rw":[480.4,535.3],"sa":[513.2,468.3],"sb":[792.3,561.6],"sc":[540.1,546],"sd":[480.2,490.2],"se":[440.9,354],"sg":[659.4,527.4],"si":[439.6,407.4],"sk":[449.7,399.9],"sl":[377,510.7],"sn":[372.5,495.4],"so":[519.4,517.6],"sr":[270.6,522],"ss":[479.4,512.1],"st":[423.9,529.5],"sv":[191.3,495],"sy":[494.6,440.1],"sz":[482.1,599.2],"td":[451.4,492.3],"tg":[409.5,510.4],"th":[650.2,493.7],"tj":[568.5,423.4],"tm":[541,425],"tn":[429.9,443.3],"tr":[485.5,428.4],"tt":[258.6,504.5],"tw":[694.1,458.7],"tz":[492.7,546.7],"ua":[474.7,399],"ug":[486.4,528.2],"us":[145.3,361.9],"uy":[279.6,619.3],"uz":[550.2,417.4],"vc":[258.3,498.9],"ve":[245.2,515.3],"vn":[661.2,485.2],"vu":[812.4,590.7],"ye":[524,491.2],"za":[464.8,605.6],"zm":[474,564.8],"zw":[477.3,579.6]}');

// Circular "platform" diagram for the intro/splash screen -- replaces the
// earlier hearth/family illustration with a Coupa-style "total platform"
// ring: a navy outer ring carrying the app's own name as a curved title,
// a light-blue band of icons for every one of the app's real header tabs
// (same order as the header itself, Home -> Help), and a glowing blue
// center sphere calling out "AI POWERED". Every label/order below is real
// -- not filler -- so this reads as an honest map of what's actually in
// the app, not a generic marketing graphic.
const PLATFORM_CENTER = { x: 220, y: 236 };
// Kept well inside PLATFORM_RING_INNER (182) even for the two long labels
// ("Fixed Expenses", "Regular Expenses") -- their fill color is the same
// dark navy as the ring stroke, so any part of a label that strayed past
// the ring's inner edge would silently vanish against it (this is what
// caused the earlier "S" of Smart Budget / trailing "s" of Expenses to
// look cut off).
const PLATFORM_ICON_RADIUS = 112;
const PLATFORM_RING_OUTER = 210;
const PLATFORM_RING_INNER = 182;
const PLATFORM_SPHERE_RADIUS = 82;

function polarPoint(cx, cy, r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arcPath(cx, cy, r, startDeg, endDeg) {
  const p1 = polarPoint(cx, cy, r, startDeg);
  const p2 = polarPoint(cx, cy, r, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
}
// Curved path the tagline rides above the TOP of the ring -- originally
// this sat at radius 196, embedded inside the ring's own 182-210
// thickness band, but per explicit request to lift it "outside" the dark
// ring rather than sit on top of it, the radius is now 224: clear past
// the ring's outer edge (210) with a visible gap, rather than overlapping
// the ring stroke. The SVG's own viewBox (see the <svg> element below) is
// extended upward to give this extra room -- without that, text this far
// out would clip against the top of the canvas.
const PLATFORM_TITLE_ARC = arcPath(PLATFORM_CENTER.x, PLATFORM_CENTER.y, 224, 200, 340);

// Dashboard (formerly "Home") deliberately isn't one of these spokes --
// it's not a distinct feature so much as the summary/overview the whole
// diagram itself already stands in for, so listing it as an 8th "function"
// alongside Income/Savings/etc. was redundant. The remaining 7 real tabs
// are spaced evenly around the full circle (360/7 apart), starting at the
// bottom (90deg) so the layout stays visually balanced without needing an
// even count.
const PLATFORM_TABS = [
  { label: 'Income', icon: 'income', angle: 90 },
  { label: 'Fixed Expenses', icon: 'fixed', angle: 90 + 360 / 7 },
  { label: 'Regular Expenses', icon: 'regular', angle: 90 + (360 / 7) * 2 },
  { label: 'Savings', icon: 'savings', angle: 90 + (360 / 7) * 3 },
  { label: 'Report', icon: 'report', angle: 90 + (360 / 7) * 4 },
  { label: 'Smart Budget', icon: 'settings', angle: 90 + (360 / 7) * 5 },
  { label: 'Help', icon: 'help', angle: 90 + (360 / 7) * 6 },
];

// Faint "network" decoration inside the center sphere -- an outer ring of
// nodes plus a hub wired to a few of them, echoing the connected-data globe
// look of the reference image without needing an actual force-graph lib.
const PLATFORM_NETWORK_DOTS = [
  { x: -46, y: -38, r: 3 }, { x: -10, y: -58, r: 2.4 }, { x: 30, y: -50, r: 3.4 },
  { x: 54, y: -14, r: 2.6 }, { x: 50, y: 26, r: 3 }, { x: 14, y: 52, r: 2.4 },
  { x: -28, y: 46, r: 3.2 }, { x: -56, y: 10, r: 2.6 }, { x: -6, y: 4, r: 2 },
];
const PLATFORM_NETWORK_LINES = [
  [-46, -38, -10, -58], [-10, -58, 30, -50], [30, -50, 54, -14], [54, -14, 50, 26],
  [50, 26, 14, 52], [14, 52, -28, 46], [-28, 46, -56, 10], [-56, 10, -46, -38],
  [-6, 4, -46, -38], [-6, 4, 30, -50], [-6, 4, 50, 26], [-6, 4, -28, 46],
];

// Small hand-drawn line-icon per tab, each in its own local 24x24 box --
// stroke/fill applied by the wrapping <g> in the icon spoke below, kept
// deliberately simple (thin outline shapes) to match the reference
// diagram's icon style rather than a detailed illustration.
function PlatformIcon({ type }) {
  switch (type) {
    case 'home':
      return (
        <g>
          <path d="M2 12 L12 3 L22 12" />
          <path d="M5 10 V21 H19 V10" />
          <rect x="10.5" y="14" width="3" height="7" />
        </g>
      );
    case 'income':
      return (
        <g>
          <rect x="2" y="6" width="20" height="14" rx="2.4" />
          <path d="M2 10 H22" />
          <circle cx="17" cy="14" r="1.6" fill="#1b2a5e" stroke="none" />
        </g>
      );
    case 'fixed':
      return (
        <g>
          <rect x="3" y="5" width="18" height="16" rx="2.2" />
          <path d="M3 10 H21" />
          <path d="M8 2 V6 M16 2 V6" />
          <path d="M9 15 L11.5 17.5 L16 12.5" />
        </g>
      );
    case 'regular':
      return (
        <g>
          <path d="M2 3 H5 L7.4 15.2 A2 2 0 0 0 9.4 17 H18 A2 2 0 0 0 20 15.4 L22 7 H6" />
          <circle cx="9.5" cy="20.5" r="1.4" fill="#1b2a5e" stroke="none" />
          <circle cx="17.5" cy="20.5" r="1.4" fill="#1b2a5e" stroke="none" />
        </g>
      );
    case 'savings':
      return (
        <g>
          <ellipse cx="11" cy="13" rx="9" ry="6.4" />
          <path d="M20 12 L23 9.5 L22 13.5 Z" />
          <circle cx="18" cy="10.6" r="0.9" fill="#1b2a5e" stroke="none" />
          <path d="M4 18.5 V21 M9 19.5 V22" />
          <path d="M2 12 A2 2 0 0 1 2 8" />
        </g>
      );
    case 'report':
      return (
        <g>
          <path d="M2 21 H22" />
          <rect x="4" y="13" width="4" height="8" />
          <rect x="10" y="8" width="4" height="13" />
          <rect x="16" y="4" width="4" height="17" />
        </g>
      );
    case 'settings':
      return (
        <g>
          <path d="M3 15 A9 9 0 0 1 21 15" />
          <path d="M12 15 L17 8" />
          <circle cx="12" cy="15" r="1.6" fill="#1b2a5e" stroke="none" />
        </g>
      );
    case 'help':
      return (
        <g>
          <circle cx="12" cy="12" r="10" />
          <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#1b2a5e" stroke="none" fontFamily="Nunito, sans-serif">?</text>
        </g>
      );
    default:
      return null;
  }
}

// Time-of-day greeting -- purely based on the visitor's own device clock
// (new Date().getHours()), so it's automatically correct for whatever
// timezone the browser itself is set to, no IP lookup or timezone library
// needed. Boundaries are the common-sense ones: morning starts at 5am,
// afternoon at noon, evening at 5pm, night from 9pm through the small
// hours.
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good Morning';
  if (h >= 12 && h < 17) return 'Good Afternoon';
  if (h >= 17 && h < 21) return 'Good Evening';
  return 'Good Night';
}

export default function Splash({ session }) {
  const [geo, setGeo] = useState(null);
  // First name only ("Vipin" out of "Vipin Lakhanpal") -- pulled from the
  // same user_metadata.full_name set at signup (see Login.jsx) that
  // Dashboard's "My details"/profile dropdown already reads. Session can
  // still be null here: the splash shows immediately on load, sometimes
  // before Supabase's own getSession() resolves in the background -- in
  // that case the greeting just quietly drops the name rather than
  // showing a placeholder or blocking on auth.
  const firstName = session?.user?.user_metadata?.full_name?.trim().split(/\s+/)[0] || null;

  useEffect(() => {
    let cancelled = false;
    fetch(GEO_LOOKUP_URL)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d || d.error) return;
        const code = (d.country_code || '').toLowerCase();
        const centroid = COUNTRY_CENTROIDS[code];
        if (!centroid) return; // country not in this map's table -- skip the dot rather than guess a position
        const countryLabel = COUNTRY_SHORT_NAMES[code] || d.country_name;
        const place = [d.city, countryLabel].filter(Boolean).join(', ');
        if (place) setGeo({ place, x: centroid[0], y: centroid[1] });
      })
      .catch(() => {
        // Silent -- the map still looks complete with no dot, and this is
        // a purely decorative detail, never worth surfacing an error for.
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="splash-screen" aria-hidden="true">
      {/* Real vector world map (WORLD_MAP_PATH above) -- actual country
          outlines rather than a hand-built dot grid, kept quiet behind the
          hearth scene via .worldmap-continents' low opacity. */}
      <svg className="splash-worldmap" viewBox={WORLD_MAP_VIEWBOX} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <g className="worldmap-continents">
          <path d={WORLD_MAP_PATH} fill="#ffffff" />
        </g>

        {/* Location dot -- only rendered once the IP lookup resolves. Red
            and genuinely blinking (opacity animation, see .geo-dot-core in
            CSS) rather than a static pin, so it reads as "this is where
            you are, live" -- plus a small label so it's clear what it's
            pointing at rather than an unexplained dot on a map. Kept at
            its own much higher opacity than the faint continent dots (see
            .geo-marker in CSS) so it's an unmistakable highlight. */}
        {geo && (
          <g className="geo-marker" transform={`translate(${geo.x} ${geo.y})`}>
            <circle className="geo-ping" r="5" fill="none" stroke="#ef4444" strokeWidth="1.6" />
            <circle className="geo-dot-core" r="3.4" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
            <text
              x="0"
              y={geo.y > 660 ? -10 : 14}
              textAnchor="middle"
              className="geo-label"
            >
              {geo.place}
            </text>
          </g>
        )}
      </svg>

      {/* Personal greeting -- the true top-of-screen element now (the
          brand tagline below this one moved down to the bottom a while
          back, see .splash-top-tagline's own comment). Name comes from
          the signed-in user's profile (falls back to no name if session
          hasn't resolved yet); the "Good X" half is always shown, driven
          purely by the visitor's own device clock via getGreeting(). */}
      <div className="splash-greeting">
        {firstName ? `Hello ${firstName}, ` : ''}{getGreeting()}
      </div>

      {/* Standalone brand line near the top -- deliberately just below the
          very top edge, on the plain solid-teal strip above where the world
          map/orbs get busy, per explicit request ("slightly down on plain
          teal solid background"), rather than competing with the main
          logo/text block anchored at the bottom. */}
      <div className="splash-top-tagline">
        {/* Same 4-point AI sparkle glyph used everywhere else in the app
            (see .splash-ai-tag / Dashboard's AI-powered tags), sized in em
            units so it always matches this line's own font-size exactly --
            including its clamp()-driven shrink on narrow phone screens --
            instead of a fixed px size that would look mismatched once the
            text itself scales. */}
        <svg className="splash-top-tagline-icon" viewBox="0 0 20 20" fill="none">
          <path d="M10 1 L12.2 7.8 L19 10 L12.2 12.2 L10 19 L7.8 12.2 L1 10 L7.8 7.8 Z" fill="#eab308" />
        </svg>
        Hearth &mdash; Spend smart. Save better. Live happier.
      </div>

      <div className="splash-orb splash-orb-1" />
      <div className="splash-orb splash-orb-2" />
      <div className="splash-orb splash-orb-3" />
      {/* Tiny twinkling points scattered across the whole background --
          the thing that turns a plain gradient into a "night sky" feel
          instead of an empty flat color. */}
      <div className="splash-dust splash-dust-1" />
      <div className="splash-dust splash-dust-2" />
      <div className="splash-dust splash-dust-3" />
      <div className="splash-dust splash-dust-4" />
      <div className="splash-dust splash-dust-5" />

      <div className="splash-center">
        <div className="splash-illustration-wrap">
        <div className="splash-illustration splash-illustration-platform">
          <svg viewBox="0 -50 440 522" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* Center sphere lit from the upper-left, deepening to navy at
                  the edges -- same "glowing globe" read as the reference
                  diagram's center, built from Hearth's own blue theme
                  rather than the earlier teal. */}
              <radialGradient id="platformSphere" cx="34%" cy="28%" r="78%">
                <stop offset="0" stopColor="#7fabf7" />
                <stop offset="48%" stopColor="#33509f" />
                <stop offset="100%" stopColor="#0e1a3f" />
              </radialGradient>
              <path id="platformTitleArc" d={PLATFORM_TITLE_ARC} fill="none" />
              <clipPath id="platformSphereClip">
                <circle cx={PLATFORM_CENTER.x} cy={PLATFORM_CENTER.y} r={PLATFORM_SPHERE_RADIUS} />
              </clipPath>
            </defs>

            {/* Outer navy ring -- drawn as one thick stroked circle rather
                than a filled donut path, simplest way to get a clean ring
                of a given thickness. */}
            <circle
              cx={PLATFORM_CENTER.x} cy={PLATFORM_CENTER.y}
              r={(PLATFORM_RING_OUTER + PLATFORM_RING_INNER) / 2}
              fill="none" stroke="#16224a" strokeWidth={PLATFORM_RING_OUTER - PLATFORM_RING_INNER}
            />
            {/* Light-blue middle band that the tab icons sit on. */}
            <circle cx={PLATFORM_CENTER.x} cy={PLATFORM_CENTER.y} r={PLATFORM_RING_INNER} fill="#eaf3fc" />

            {/* Tagline curved along the top of the ring, per explicit
                request to have it "circled around the circle" rather than
                a separate straight heading. */}
            <text className="platform-title-text">
              <textPath href="#platformTitleArc" startOffset="50%" textAnchor="middle">
                Smart Expense Management Platform
              </textPath>
            </text>

            {/* One spoke per real header tab -- icon + label, evenly ringed
                around the center, each popping in with a staggered delay. */}
            {PLATFORM_TABS.map((tab, i) => {
              const pos = polarPoint(PLATFORM_CENTER.x, PLATFORM_CENTER.y, PLATFORM_ICON_RADIUS, tab.angle);
              return (
                // Position (SVG transform attribute) and the pop-in
                // animation (CSS transform: scale, via .platform-tab-icon)
                // are deliberately split across two nested <g>s -- a CSS
                // `transform` completely replaces an element's own SVG
                // `transform` attribute rather than combining with it, so
                // putting both on one node silently drops the translate
                // and stacks every icon on top of each other at (0,0).
                // Two-word labels ("Fixed Expenses", "Regular Expenses",
                // "Smart Budget") are split onto two shorter lines instead
                // of one long one -- the single-line version's horizontal
                // width was what pushed right up against the ring for the
                // labels sitting near the left/right side of the circle
                // (where a label's x-extent adds directly toward the ring
                // rather than being absorbed by empty vertical space), so
                // wrapping cuts each line's width roughly in half and buys
                // a large, unambiguous margin instead of a marginal one.
                (() => {
                  const words = tab.label.split(' ');
                  const isTwoLine = words.length > 1;
                  return (
                    <g key={tab.label} transform={`translate(${pos.x - 12} ${pos.y - 22})`}>
                      <g className="platform-tab-icon" style={{ animationDelay: `${0.7 + i * 0.09}s` }}>
                        <g stroke="#1b2a5e" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <PlatformIcon type={tab.icon} />
                        </g>
                        {isTwoLine ? (
                          <text textAnchor="middle" className="platform-tab-label">
                            <tspan x="12" y="31">{words[0]}</tspan>
                            <tspan x="12" y="41">{words.slice(1).join(' ')}</tspan>
                          </text>
                        ) : (
                          <text x="12" y="34" textAnchor="middle" className="platform-tab-label">{tab.label}</text>
                        )}
                      </g>
                    </g>
                  );
                })()
              );
            })}

            {/* Center sphere -- gentle continuous pulse, plus a faint
                network of nodes/lines clipped to its circle. */}
            <circle
              className="platform-sphere-pulse"
              cx={PLATFORM_CENTER.x} cy={PLATFORM_CENTER.y} r={PLATFORM_SPHERE_RADIUS}
              fill="url(#platformSphere)"
            />
            <g clipPath="url(#platformSphereClip)" className="platform-network">
              {PLATFORM_NETWORK_LINES.map(([x1, y1, x2, y2], i) => (
                <line
                  key={i}
                  x1={PLATFORM_CENTER.x + x1} y1={PLATFORM_CENTER.y + y1}
                  x2={PLATFORM_CENTER.x + x2} y2={PLATFORM_CENTER.y + y2}
                  stroke="#ffffff" strokeWidth="0.7" opacity="0.28"
                />
              ))}
              {PLATFORM_NETWORK_DOTS.map((d, i) => (
                <circle key={i} cx={PLATFORM_CENTER.x + d.x} cy={PLATFORM_CENTER.y + d.y} r={d.r} fill="#ffffff" opacity="0.55" />
              ))}
            </g>

            <text x={PLATFORM_CENTER.x} y={PLATFORM_CENTER.y - 30} textAnchor="middle" className="platform-center-kicker">AI POWERED</text>
            <text x={PLATFORM_CENTER.x} y={PLATFORM_CENTER.y + 8} textAnchor="middle" className="platform-center-brand">Hearth</text>
            <text x={PLATFORM_CENTER.x} y={PLATFORM_CENTER.y + 29} textAnchor="middle" className="platform-center-stat">Income &middot; Bills &middot; Savings</text>
            <text x={PLATFORM_CENTER.x} y={PLATFORM_CENTER.y + 42} textAnchor="middle" className="platform-center-stat">All In One Household View</text>
          </svg>
        </div>
        </div>

        {/* Grouped in their own wrapper with a tight gap (see
            .splash-tagline-group) -- the parent .splash-center's own gap
            is generous by design (breathing room between the big circle
            diagram and the text below it), but that same gap looked too
            loose between these two short lines sitting right on top of
            each other, per explicit request to join them more closely. */}
        <div className="splash-tagline-group">
          <div className="splash-tagline">The heart of your home&rsquo;s finances.</div>
          <div className="splash-version">{formatVersionBadge()}</div>
        </div>
      </div>

      <div className="splash-credit">Conceptualised, Designed and Created by &ndash;Vipin Lakhanpal</div>
    </div>
  );
}
