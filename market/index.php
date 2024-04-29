<?php 
session_start();
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Market - Among Demons</title>
    <meta name="description" content="Testing stuff">
    <meta name="keywords" content="tag 1, tag 2">
    <meta name="author" content="Among Demons">

    
    <?php require_once("../data/parts/includes.php"); ?>
    <link rel="icon" href="/data/img/AmongDemons_LogoSquare.png" type="image/x-icon">
  </head>
  <body>
    <?php require_once("../data/parts/nav.php"); ?>
    <main class="container">
        <div id="collection">
            <div>
                <p>Among Demons NFTs</p>
                <h2>Recent Transactions</h2>
                <div class="nfts">
                    <?php 
                    function format_star_price($price) {
                        $price = $price / 1000000;
                        if ($price >= 1000)
                            $price = number_format((float)($price/1000), 1, '.', ''). "k";
                        return  $price;
                    }
                    $nfts = json_decode(file_get_contents("../nfts/latest-transactions.js"));
                    $i=1;
                    foreach ($nfts->data->events->edges as $nft) {
                    ?>
                        <div class="element">
                            <img src="https://ipfs-gw.stargaze-apis.com/ipfs/bafybeigq4wumd2ddud7cim2jcdibkcmkk45sv27fgnxyta63z6g5szm2ma/<?php echo $nft->node->data->tokenId;?>.png" alt="">
                            <a class="id" href="https://www.stargaze.zone/marketplace/stars1avp0vggx4ke9pnxpkv8f3g7uddl2rmjwnzme9qx7cask2788wa3s7hesgp/<?php echo $nft->node->data->tokenId;?>" target="_blank">#<?php echo sprintf('%04d', $nft->node->data->tokenId);?></a>
                            <span class="price"><?php echo format_star_price($nft->node->data->price);?> STAR ($<?php echo $nft->node->data->priceUsd;?>)</span>
                            <span class="date"><?php echo date("d M Y", strtotime($nft->node->createdAt));?></span>
                        </div>
                    <?php
                        $i++;
                    }
                    ?>
                    <div class="sync">
                        <?php
                        function time_elapsed_string($datetime, $full = false) {
                            $now = new DateTime;
                            $ago = new DateTime($datetime);
                            $diff = $now->diff($ago);
                        
                            $diff->w = floor($diff->d / 7);
                            $diff->d -= $diff->w * 7;
                        
                            $string = array(
                                'y' => 'year',
                                'm' => 'month',
                                'w' => 'week',
                                'd' => 'day',
                                'h' => 'hour',
                                'i' => 'minute',
                                's' => 'second',
                            );
                            foreach ($string as $k => &$v) {
                                if ($diff->$k) {
                                    $v = $diff->$k . ' ' . $v . ($diff->$k > 1 ? 's' : '');
                                } else {
                                    unset($string[$k]);
                                }
                            }
                        
                            if (!$full) $string = array_slice($string, 0, 1);
                            return $string ? implode(', ', $string) . ' ago' : 'just now';
                        }
                        ?>
                        Updated <?php echo time_elapsed_string("@".$nfts->updated);?>
                    </div>
                </div>

                <div class="more">
                    <h3>Join the fight!</h3>
                    <p>Own an uniquely generated profile picture from our collection.</p>
                    <a href="https://www.stargaze.zone/marketplace/stars1avp0vggx4ke9pnxpkv8f3g7uddl2rmjwnzme9qx7cask2788wa3s7hesgp" target="_blank">View All Demons</a>
                </div>
            </div>
        </div>
    </main>
  </body>
</html>