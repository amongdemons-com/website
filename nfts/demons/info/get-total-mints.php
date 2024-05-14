<?php

$graphql_url = 'https://graphql.mainnet.stargaze-apis.com/graphql';
$contract_address = 'stars1mesfmezthl2r592gqs9zgamdkcr5q3rhf0vuzcaal2w8kza57yfqfn55tz';
$file_path = "get-total-mints.js";
$cache_time = 300; // 5 minutes in seconds

function getDataFromApi($graphql_url, $contract_address) {
    $data = [
        'query' => '
            query TokenCounts($address: String!) {
                collection(address: $address) {
                    tokenCounts {
                        minted
                        airdropped
                    }
                }
            }
        ',
        'variables' => [
            'address' => $contract_address
        ]
    ];

    $options = [
        CURLOPT_URL => $graphql_url,
        CURLOPT_POST => TRUE,
        CURLOPT_RETURNTRANSFER => TRUE,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode($data)
    ];

    $ch = curl_init();
    curl_setopt_array($ch, $options);
    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response);
}

function updateCacheFile($file_path, $data) {
    file_put_contents($file_path, json_encode($data));
}

function readCacheFile($file_path) {
    if (file_exists($file_path)) {
        return json_decode(file_get_contents($file_path));
    }
    return null;
}

// Read the cache file
$cached_data = readCacheFile($file_path);
$current_time = time();

if ($cached_data && isset($cached_data->time) && ($current_time - $cached_data->time) < $cache_time) {
    // Use the cached data
    echo json_encode($cached_data);
} else {
    // Get data from API
    $decoded = getDataFromApi($graphql_url, $contract_address);

    if (isset($decoded->errors)) {
        // Handle errors
        echo 'GraphQL errors: ', print_r($decoded->errors, true);
    } else {
        // Process the response data
        $file = new stdClass();
        $file->time = $current_time;
        $file->minted = $decoded->data->collection->tokenCounts->minted;
        $file->airdropped = $decoded->data->collection->tokenCounts->airdropped;

        // Update the cache file
        updateCacheFile($file_path, $file);

        // Output the response
        echo json_encode($file);
    }
}

?>
