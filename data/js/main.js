$(document).ready(function() {
    console.log("main.js: loaded");

    $('body').on('click', '.click-to-copy', function(event) {
        event.preventDefault();
        var textToCopy = $(this).find('span').html();

        console.log("copied text: " + textToCopy);
        var $tempInput = $('<input>');
        $('body').append($tempInput);
        $tempInput.val(textToCopy).select();
        document.execCommand('copy');
        $tempInput.remove();

        
        $(this).find('.click-to-copy-icon').fadeOut(0);
        $(this).find('.click-to-copy-icon-success').fadeIn();
    });
});