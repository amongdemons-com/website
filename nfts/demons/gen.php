<?php 
ini_set('display_errors', 1);
error_reporting(E_ALL); 

function copyImage($sourcePath, $destinationPath) {
  // Validate file existence and permissions
  if (!file_exists($sourcePath) || !is_readable($sourcePath)) {
    throw new Exception("Source file '$sourcePath' does not exist or is not readable.");
  }

  // Get image information (optional, but useful for error handling)
  $imageInfo = getimagesize($sourcePath);
  if (!$imageInfo) {
    throw new Exception("Failed to get image information for '$sourcePath'.");
  }

  // Check if destination directory exists and has write permissions
  if (!file_exists(dirname($destinationPath)) || !is_writable(dirname($destinationPath))) {
    throw new Exception("Destination directory '" . dirname($destinationPath) . "' does not exist or is not writable.");
  }

  // Use copy function to copy the image
  if (!copy($sourcePath, $destinationPath)) {
    throw new Exception("Failed to copy image from '$sourcePath' to '$destinationPath'.");
  }

  return true; // Success
}

function genMetadata($model, $i) {
  $type = ceil($model/6);
  return '{
    "attributes": [
      {
        "trait_type": "Rarity",
        "value": "'.ucfirst(getRarity($model%6)).'"
      },
      {
        "trait_type": "Type",
        "value": '.$type.'
      }
    ],
    "description": "A mysterious creature in this new world Among Demons.",
    "external_url": "https://amongdemons.com/nfts/demons/?type='.$type.'",
    "name": "'.getName($model).' #'.sprintf("%04d", $i).'"
  }';
}

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

function getName($i) {
  $name = ceil($i/6);
  $rarity = ucfirst(getRarity($i%6));
  switch ($name) {
    case 1:
      return $rarity." Boof Nitza";
    case 2:
      return $rarity." Gon G'ah";
    case 3:
      return $rarity." Ma'Zga";
    case 4:
      return $rarity." Tor Tza";
    case 5:
      return $rarity." Vi'Zel";
    case 6:
      return $rarity." Goh Loomb";
    case 7:
      return $rarity." Baobaw";
    case 8:
      return $rarity." Ko Pak";
    case 9:
      return $rarity." Chu Perk";
    case 10:
      return $rarity." Ba Be'aga";
    case 11:
      return $rarity." Vee Scol";
    default:
      return "Unknown";
  }
}

function populate($nfts) {
  $newArray = [];
  for ($i = 0; $i < count($nfts); $i++) {
    // Append the current index to the new array the specified number of times
    $newArray = array_merge($newArray, array_fill(0, $nfts[$i], ($i+1)));
  }
  return $newArray;
}

$nfts = [
  151, 131, 111, 91, 71, 51,
  151, 131, 111, 91, 71, 51,
  151, 131, 111, 91, 71, 51,
  151, 131, 111, 91, 71, 51,
  151, 131, 111, 91, 71, 51,
  151, 131, 111, 91, 71, 51,
  151, 131, 111, 91, 71, 51,
  151, 131, 111, 91, 71, 51,
  151, 131, 111, 91, 71, 51,
  151, 131, 111, 91, 71, 51,
  151, 131, 111, 91, 71, 51
];

$gen = populate($nfts);
shuffle($gen);

echo "Total: ".count($gen)."<br/>";

/*
$uniqueCounts = array_count_values($gen);
print_r($uniqueCounts);*/

print_r($gen);

echo genMetadata(51, 6666);
/*
try {
  copyImage("models/66.png", "images/6666.png");
  file_put_contents("metadata/6666.json", genMetadata(66, 6666));
  echo "Image copied successfully!";
} catch (Exception $e) {
  echo "Error copying image: " . $e->getMessage();
}*/

?>