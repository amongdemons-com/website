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
    <meta name="description" content="We converted the first demon models into Stargaze NFTs. Owning a piece makes you a supporter of the Among Demons project.">
    <meta name="author" content="Among Demons">
    <meta property="og:image" content="https://amongdemons.com/nfts/demons/faq/learnmore_founders_collection.png" />

    <?php require_once("../../../data/parts/includes.php"); ?>
  </head>
  <body>
    <?php require_once("../../../data/parts/nav.php"); ?>
    <main class="container">
      <div class="row py-2">
        <div class="col-md-6 col-sm-12">
          <div id="demonsSlider" class="carousel slide" data-bs-ride="carousel">
            <div class="carousel-inner">
              <div class="carousel-item active">
                <img src="/nfts/demons/models/41.png" class="d-block w-100" alt="Legendary Baobaw">
                <div class="carousel-caption d-block p-0 bg-dark">
                  <h5 class="my-1 py-2 text-dark-emphasis bg-dark-subtle"><span class="ad-legendary">Legendary</span> Baobaw</h5>
                </div>
              </div>
              <div class="carousel-item">
                <img src="/nfts/demons/models/8.png" class="d-block w-100" alt="Uncommon Gon G'ah">
                <div class="carousel-caption d-block p-0 bg-dark">
                  <h5 class="my-1 py-2 text-dark-emphasis bg-dark-subtle"><span class="ad-uncommon">Uncommon</span> Gon G'ah</h5>
                </div>
              </div>
              <div class="carousel-item">
                <img src="/nfts/demons/models/58.png" class="d-block w-100" alt="Epic Ba Be'aga">
                <div class="carousel-caption d-block p-0 bg-dark">
                  <h5 class="my-1 py-2 text-dark-emphasis bg-dark-subtle"><span class="ad-epic">Epic</span> Ba Be'aga</h5>
                </div>
              </div>
              <div class="carousel-item">
                <img src="/nfts/demons/models/13.png" class="d-block w-100" alt="Common Ma'Zga">
                <div class="carousel-caption d-block p-0 bg-dark">
                  <h5 class="my-1 py-2 text-dark-emphasis bg-dark-subtle"><span class="ad-common">Common</span> Ma'Zga</h5>
                </div>
              </div>
              <div class="carousel-item">
                <img src="/nfts/demons/models/53.png" class="d-block w-100" alt="Legendary Chu Perk">
                <div class="carousel-caption d-block p-0 bg-dark">
                  <h5 class="my-1 py-2 text-dark-emphasis bg-dark-subtle"><span class="ad-legendary">Legendary</span> Chu Perk</h5>
                </div>
              </div>
              <div class="carousel-item">
                <img src="/nfts/demons/models/27.png" class="d-block w-100" alt="Legendary Chu Perk">
                <div class="carousel-caption d-none d-md-block p-0 bg-dark">
                  <h5 class="my-1 py-2 text-dark-emphasis bg-dark-subtle"><span class="ad-rare">Rare</span> Vi'Zel</h5>
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
        <div class="col-md-6 col-sm-12 my-auto py-4">
          <h1>Founders Collection</h1>
          <p class="fs-5 py-2">We converted the first <a class="text-center" href="/nfts/demons/" target="_blank">demon models</a> into NFTs. Owning a piece makes you a supporter of the Among Demons project.</p>
          
          <!--<p class="text-center text-secondary mb-0">Game Dev Start</p>-->
          <p class="text-center text-secondary mb-0">Game Dev Start</p>
          
          <div class="progress mb-4 position-relative" role="progressbar" aria-label="Info example" aria-valuenow="<?php echo $devGoal;?>" aria-valuemin="0" aria-valuemax="100" style="height: 40px">
            <div id="progressBar" class="progress-bar bg-info overflow-visible"></div>
            <div id="progressBarLabel" class="position-absolute top-50 start-50 translate-middle text-white"></div>
          </div>
          <script>
            // Function to fetch data from the PHP script
            function fetchData() {
              fetch('/nfts/demons/info/get-total-mints.php')
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        console.error('Error:', data.error, data.details);
                        document.getElementById('progressBarLabel').innerText = ' Error loading data ';
                    } else {
                        $('#progressBarLabel').html(data.minted + ` / 6666`);
                        $('#progressBar').css({"width":((data.minted/6666)*100)+"%"});
                    }
                })
                .catch(error => {
                    console.error('Fetch Error:', error);
                    document.getElementById('progressBarLabel').innerText = ' Error loading data ';
                });
            }

            // Fetch data when the page loads
            window.onload = fetchData;
          </script>
          
          <p class="text-center mb-5">
            <a href="<?php echo $stargazeUrl; ?>" target="_blank">
              <button type="button" class="btn btn-success">Mint on Stargaze</button>
            </a>
          </p>

          <h2 class="text-center py-2">FAQ</h2>

          <div class="accordion accordion-flush" id="demonsFAQ">
            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#flush-collapseOne" aria-expanded="false" aria-controls="flush-collapseOne">
                  What do I need to get one?
                </button>
              </h2>
              <div id="flush-collapseOne" class="accordion-collapse collapse" data-bs-parent="#demonsFAQ">
                <div class="accordion-body">
                  <p>Before trying to buy an NFT, you'll need to create a <a href="https://cosmos.network/wallets/" target="_blank">Cosmos wallet</a>.</p>
                  <p>Once you have that ready, it's time to get some <span class="text-warning-emphasis">STARS</span>. Go to <a href="<?php echo $stargazeUrl; ?>" target="_blank">stargaze.zone</a> and click on the [Get STARS] button situated in the top right corner of the website.</p>
                  <p>If you need extra help, we'll gladly guide you. Join our <a href="/discord" target="_blank">discord</a> server and ask your question.<p>
                </div>
              </div>
            </div>
            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#flush-collapseTwo" aria-expanded="false" aria-controls="flush-collapseTwo">
                  How many NFTs can be minted?
                </button>
              </h2>
              <div id="flush-collapseTwo" class="accordion-collapse collapse" data-bs-parent="#demonsFAQ">
                <div class="accordion-body">
                  <p>In this world, we have 11 types of demons, 6 models in each category and you can mint each one as follows:</p>
                  <div class="row mb-4">
                    <div class="col-md-6 col-sm-12 d-flex justify-content-center">
                      <span class="w-25 text-end pe-2">151</span>
                      <span class="w-50 ad-common">Common</span>
                    </div>
                    <div class="col-md-6 col-sm-12 d-flex justify-content-center">
                      <span class="w-25 text-end pe-2">131</span>
                      <span class="w-50 ad-uncommon">Uncommon</span>
                    </div>
                    <div class="col-md-6 col-sm-12 d-flex justify-content-center">
                      <span class="w-25 text-end pe-2">111</span>
                      <span class="w-50 ad-rare">Rare</span>
                    </div>
                    <div class="col-md-6 col-sm-12 d-flex justify-content-center">
                      <span class="w-25 text-end pe-2">91</span>
                      <span class="w-50 ad-epic">Epic</span>
                    </div>
                    <div class="col-md-6 col-sm-12 d-flex justify-content-center">
                      <span class="w-25 text-end pe-2">71</span>
                      <span class="w-50 ad-legendary">Legendary</span>
                    </div>
                    <div class="col-md-6 col-sm-12 d-flex justify-content-center">
                      <span class="w-25 text-end pe-2">51</span>
                      <span class="w-50 ad-mythic">Mythic</span>
                    </div>
                  </div>
                  <p>If we do the math, there are:</p>
                  <div class="row mb-4">
                    <div class="col-md-6 col-sm-12 text-center">Unique / Total</div>
                    <div class="col-md-6 col-sm-12 text-center"><span class="fw-bold text-danger-emphasis">66</span> / <span class="fw-bold text-danger-emphasis">6666</span></div>
                  </div>
                  <p>All NFTs are minted for the same price, despite rarity. The order is randomized.</p>
                </div>
              </div>
            </div>
            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#flush-collapseThree" aria-expanded="false" aria-controls="flush-collapseThree">
                  What's the price?
                </button>
              </h2>
              <div id="flush-collapseThree" class="accordion-collapse collapse" data-bs-parent="#demonsFAQ">
                <div class="accordion-body">
                  <p>Each NFT is created for <span class="fw-bold text-danger-emphasis">66</span> <span class="text-warning-emphasis">STARS</span></p>
                  <p>Of course, there is a secondary <a href="<?php echo $stargazeUrlAll; ?>" target="_blank">market</a> where people trade them at whatever price they like.</p>
                </div>
              </div>
            </div>
            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#flush-collapseFour" aria-expanded="false" aria-controls="flush-collapseThree">
                  Targets and rewards
                </button>
              </h2>
              <div id="flush-collapseFour" class="accordion-collapse collapse" data-bs-parent="#demonsFAQ">
                <div class="accordion-body">
                  <p>The Founders Collection was created to fund the development of the Among Demons <a href="https://x.com/AmongDemonsGame/status/1788847266528149966" target="_blank">browser-based game</a>.</p>
                  <p>When we hit 6666 mints, we'll start working on it.</p>
                  <p>As an incentive, we'll be <span class="fw-bold text-success-emphasis">giving away</span> <span class="fw-bold text-warning-emphasis">100 NFTs</span> for each <span class="fw-bold text-warning-emphasis">1000</span> minted. They will be randomly airdropped to holders.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    <?php require_once("../../../data/parts/footer.php"); ?>
  </body>
</html>