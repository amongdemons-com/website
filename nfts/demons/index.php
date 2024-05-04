<?php 
session_start();

function getRarity($i) {
  switch ($i%6) {
    case 1:
      return 'common';
      break;
    case 2:
      return 'uncommon';
      break;
    case 3:
      return 'rare';
      break;
    case 4:
      return 'epic';
      break;
    case 5:
      return 'legendary';
      break;
    case 0:
      return 'mythic';
      break;
    default:
      echo "unknown";
  }
}

function getTypeName($i) {
  switch ($i) {
    case 1:
      return "Boof Nitza";
    case 2:
      return "Gon G'ah";
    case 3:
      return "Ma'Zga";
    case 4:
      return "Tor Tza";
    case 5:
      return "Vi'Zel";
    case 6:
      return "Goh Loomb";
    case 7:
      return "???";
    case 8:
      return "Ko Pak";
    case 9:
      return "Chu Perk";
    case 10:
      return "???";
    case 11:
      return "Vee Scol";
    default:
      return "Unknown";
  }
}

// Define the image folder path
$imageFolder = 'images/';

// Define number of images per page (adjust as needed)
$perPage = 6;
$totalImages = 66;

// Get the current page number from URL parameter (optional)
$currentPage = (isset($_GET['type'])) ? (int)$_GET['type'] : 1;

// Calculate total number of pages
$totalPages = ceil($totalImages / $perPage);

// Check for invalid page number
if ($currentPage < 1 || $currentPage > $totalPages) {
  $currentPage = 1;
}
$demonName = getTypeName($currentPage);

// Offset for image selection based on current page
$offset = ($currentPage - 1) * $perPage;
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title><?php echo $demonName; ?> - Among Demons NFTs</title>
    <meta name="description" content="Demon type <?php echo $currentPage; ?> | These models are part of the founders collection. The NFTs are minted and transacted on Stargaze from the Cosmos ecosystem.">
    <meta name="author" content="Among Demons">

    <?php require_once("../../data/parts/includes.php"); ?>
    <link rel="icon" href="/data/img/AmongDemons_LogoSquare.png" type="image/x-icon">
  </head>
  <body>
    <?php require_once("../../data/parts/nav.php"); ?>
    <main class="container">
      <h1 class="text-center pt-3"><?php echo $demonName; ?></h1>
      <h5 class="text-center">demon type <?php echo $currentPage; ?></h5>
      <div class="row row-cols-1 row-cols-md-3 row-cols-lg-3 row-cols-xl-3 g-2 py-4">
        <?php
        // Loop through each image and display it
        for ($i=$offset+1; $i<=$offset+6; $i++) { ?>
          <div class="col">
            <div class="card h-100">
              <img src="<?php echo "/nfts/demons/models/".$i.".png";?>" class="card-img-top" alt="<?php echo ucfirst(getRarity($i))." ".$demonName; ?>" title="<?php echo ucfirst(getRarity($i))." ".$demonName; ?>">
              <div class="card-body text-center">
                <h5 class="card-title m-0 ad-<?php echo getRarity($i); ?>"><?php echo ucfirst(getRarity($i)); ?></h5>
              </div>
            </div>
          </div>
        <?php } ?>
      </div>
      <nav>
        <ul class="pagination justify-content-center">
          <?php
          // Pagination links
          if ($totalPages > 1) {
            if ($currentPage > 1) {
              echo '<li class="page-item"><a class="page-link" href="?type=' . ($currentPage - 1) . '">Previous</a></li>';
            }
            for ($i = 1; $i <= $totalPages; $i++) {
              $active = ($i == $currentPage) ? 'class="page-link active"' : 'class="page-link"';
              echo '<li class="page-item"><a '.$active.' href="?type=' . $i . '">' . $i . '</a></li>';
            }
            if ($currentPage < $totalPages) {
              echo '<li class="page-item"><a class="page-link" href="?type=' . ($currentPage + 1) . '">Next</a></li>';
            }
          }
          ?>
        </ul>
      </nav>
    </main>
  </body>
</html>