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

    <?php require_once("../../data/parts/includes.php"); ?>
    <link rel="icon" href="/data/img/AmongDemons_LogoSquare.png" type="image/x-icon">
  </head>
  <body>
    <?php require_once("../../data/parts/nav.php"); ?>
    <main class="container">
      <div class="row row-cols-1 row-cols-md-3 row-cols-lg-3 row-cols-xl-3 g-2 py-4">
        <?php
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

        // Offset for image selection based on current page
        $offset = ($currentPage - 1) * $perPage;

        // Loop through each image and display it
        for ($i=$offset+1; $i<=$offset+6; $i++) { ?>
          <div class="col">
            <div class="card h-100">
              <img src="<?php echo "/nfts/demons/images/".$i.".png";?>" class="card-img-top" alt="...">
              <div class="card-body">
                <h5 class="card-title">Card title</h5>
                <p class="card-text">Some quick example text to build on the card title and make up the bulk of the card's content.</p>
                <a href="#" class="btn btn-primary">Go somewhere</a>
              </div>
            </div>
          </div>
        <?php } ?>
      </div>
      <nav aria-label="Page navigation example">
        <ul class="pagination justify-content-center">
          <?php
          // Pagination links (adjust styling as needed)
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