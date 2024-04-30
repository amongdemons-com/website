<?php 
session_start();
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Among Demons</title>
    <meta name="description" content="Testing stuff">
    <meta name="keywords" content="tag 1, tag 2">
    <meta name="author" content="Among Demons">

    <?php require_once("../../../data/parts/includes.php"); ?>
    <link rel="icon" href="/data/img/AmongDemons_LogoSquare.png" type="image/x-icon">
  </head>
  <body>
    <?php require_once("../../../data/parts/nav.php"); ?>
    <main class="container">
      <h1 style="text-align: center;">faq</h1>
      <div class="accordion accordion-flush">
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseOne" aria-expanded="false" aria-controls="panelsStayOpen-collapseOne">
              How many NFTs can be minted?
            </button>
          </h2>
          <div id="panelsStayOpen-collapseOne" class="accordion-collapse collapse">
            <div class="accordion-body">
              <p>In this world, we have 11 types of demons, 6 models in each category and you can mint each one as follws:</p>

              <table class="table table-sm text-center">
                <tbody>
                  <tr>
                    <td>151</td>
                    <td>Common</td>
                    <td>91</td>
                    <td>Epic</td>
                  </tr>
                  <tr>
                    <td>131</td>
                    <td>Uncommon</td>
                    <td>71</td>
                    <td>Legendary</td>
                  </tr>
                  <tr>
                    <td>111</td>
                    <td>Rare</td>
                    <td>51</td>
                    <td>Mythic</td>
                  </tr>
                </tbody>
              </table>

              <p>If we do the math, there are:</p>
              <table class="table table-sm text-center">
                <tbody>
                  <tr>
                    <td>Unique / Total</td>
                    <td>66 / 6666</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseTwo" aria-expanded="false" aria-controls="panelsStayOpen-collapseTwo">
              Accordion Item #2
            </button>
          </h2>
          <div id="panelsStayOpen-collapseTwo" class="accordion-collapse collapse">
            <div class="accordion-body">
              <strong>This is the second item's accordion body.</strong> It is hidden by default, until the collapse plugin adds the appropriate classes that we use to style each element. These classes control the overall appearance, as well as the showing and hiding via CSS transitions. You can modify any of this with custom CSS or overriding our default variables. It's also worth noting that just about any HTML can go within the <code>.accordion-body</code>, though the transition does limit overflow.
            </div>
          </div>
        </div>
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseThree" aria-expanded="false" aria-controls="panelsStayOpen-collapseThree">
              Accordion Item #3
            </button>
          </h2>
          <div id="panelsStayOpen-collapseThree" class="accordion-collapse collapse">
            <div class="accordion-body">
              <strong>This is the third item's accordion body.</strong> It is hidden by default, until the collapse plugin adds the appropriate classes that we use to style each element. These classes control the overall appearance, as well as the showing and hiding via CSS transitions. You can modify any of this with custom CSS or overriding our default variables. It's also worth noting that just about any HTML can go within the <code>.accordion-body</code>, though the transition does limit overflow.
            </div>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>