<?php 
session_start();
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Founders Collection - Among Demons NFTs</title>
    <meta name="description" content="We converted the first demon models into NFTs. Owning a piece makes you a supporter of the Among Demons project.">
    <meta name="author" content="Among Demons">

    <?php require_once("data/parts/includes.php"); ?>
    <link rel="icon" href="/data/img/AmongDemons_LogoSquare.png" type="image/x-icon">
  </head>
  <body>
    <?php require_once("data/parts/nav.php"); ?>
    <main class="container">
      <div class="row py-2">
        <div class="col-md-6 col-sm-12">
          <div id="demonsSlider" class="carousel slide" data-bs-ride="carousel">
            <div class="carousel-inner">
              <div class="carousel-item active">
                <img src="/nfts/demons/models/1.png" class="d-block w-100" alt="...">
                <div class="carousel-caption d-none d-md-block p-0 bg-dark">
                  <h5 class="my-1 py-2 text-dark-emphasis bg-dark-subtle">Boof Nitza</h5>
                </div>
              </div>
              <div class="carousel-item">
                <img src="/nfts/demons/models/7.png" class="d-block w-100" alt="...">
                <div class="carousel-caption d-none d-md-block p-0 bg-dark">
                  <h5 class="my-1 py-2 text-dark-emphasis bg-dark-subtle">Gon G'ah</h5>
                </div>
              </div>
              <div class="carousel-item">
                <img src="/nfts/demons/models/14.png" class="d-block w-100" alt="...">
                <div class="carousel-caption d-none d-md-block p-0 bg-dark">
                  <h5 class="my-1 py-2 text-dark-emphasis bg-dark-subtle">Ma'Zga</h5>
                </div>
              </div>
            </div>
            <button class="carousel-control-prev" type="button" data-bs-target="#demonsSlider" data-bs-slide="prev">
              <span class="carousel-control-prev-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Previous</span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#demonsSlider" data-bs-slide="next">
              <span class="carousel-control-next-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Next</span>
            </button>
          </div>
        </div>
        <div class="col-md-6 col-sm-12 my-auto">
          <h1>Founders Collection</h1>
          <p>We converted the first <a class="text-center" href="/nfts/demons/" target="_blank">demon models</a> into NFTs. Owning a piece makes you a supporter of the Among Demons project.</p>
          
          <a class="text-center" href="https://www.stargaze.zone/p/badkids/" target="_blank">
            <button type="button" class="btn btn-primary">Buy on Stargaze</button>
          </a>

          <h2 class="text-center py-2 mt-4">FAQ</h2>

          <div class="accordion accordion-flush" id="demonsFAQ">
            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#flush-collapseOne" aria-expanded="false" aria-controls="flush-collapseOne">
                  How can I get one?
                </button>
              </h2>
              <div id="flush-collapseOne" class="accordion-collapse collapse" data-bs-parent="#demonsFAQ">
                <div class="accordion-body">Placeholder content for this accordion, which is intended to demonstrate the <code>.accordion-flush</code> class. This is the first item's accordion body.</div>
              </div>
            </div>
            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#flush-collapseTwo" aria-expanded="false" aria-controls="flush-collapseTwo">
                  How many NFTs can be minted?
                </button>
              </h2>
              <div id="flush-collapseTwo" class="accordion-collapse collapse" data-bs-parent="#demonsFAQ">
                <div class="accordion-body">Placeholder content for this accordion, which is intended to demonstrate the <code>.accordion-flush</code> class. This is the second item's accordion body. Let's imagine this being filled with some actual content.</div>
              </div>
            </div>
            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#flush-collapseThree" aria-expanded="false" aria-controls="flush-collapseThree">
                  What's the price?
                </button>
              </h2>
              <div id="flush-collapseThree" class="accordion-collapse collapse" data-bs-parent="#demonsFAQ">
                <div class="accordion-body">Placeholder content for this accordion, which is intended to demonstrate the <code>.accordion-flush</code> class. This is the third item's accordion body. Nothing more exciting happening here in terms of content, but just filling up the space to make it look, at least at first glance, a bit more representative of how this would look in a real-world application.</div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </main>
  </body>
</html>