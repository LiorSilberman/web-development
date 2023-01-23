function change_background_color(value){
    let bgcolor = document.body.style.backgroundColor;
    let color = document.body.style.color;
    switch(value)
    {
        case 'light':
            bgcolor = 'white';
            color = 'black';
            $("#bright").attr('src', 'golden_ratio_image.png');
        break;
        
        case 'dark':
            bgcolor = '#222211';
            color = 'white';
            $("#bright").attr('src', 'golden_ratio_dark.png');
        break;
    }
    document.body.style.backgroundColor = bgcolor;
    document.body.style.color = color;
}

function show_rects_a(){
    let firstValue = document.getElementById("first").value;

    if (check_number_error(firstValue)){
        alert("a: Must be a valid number");
        resetForm();
        return;
    }
    
    firstValue = parseFloat(firstValue);
    let secondValue = (firstValue / 1.618).toFixed(2);
    document.getElementById("second").value = secondValue.toString();
    count_result(firstValue, secondValue);
    resizeRectangles(firstValue, secondValue);
}

function show_rects_b(){
    let secondValue = document.getElementById("second").value;
    if (check_number_error(secondValue)){
        alert("b: Must be a valid number");
        resetForm();
        return;
    }
    secondValue = parseFloat(secondValue);
    let firstValue = (secondValue * 1.618).toFixed(2);
    document.getElementById("first").value = firstValue.toString();
    count_result(firstValue, secondValue);
    resizeRectangles(firstValue, secondValue);
}

function count_result(firstValue, secondValue){
    let res = parseFloat(firstValue) + parseFloat(secondValue);
    if (firstValue.toString() == 'NaN' || secondValue.toString() == 'NaN' || res.toString() == 'NaN'){
        return false;
    }
    $('#res').text(res.toFixed(2));
    return true;
    
}

function check_number_error(val){
    const regex = new RegExp(/[a-zA-Z]/, 'g');
    if (val.match(regex)) {
       return true;
    }
    return false;
}


function resizeRectangles(firstValue, secondValue){
    rectA = $('#rect-a');
    rectB = $('#rect-b');
    rects = $('#rect-a,#rect-b');

    if (!check_too_big(firstValue, secondValue)){
        alert('Rectangle is too big to draw');
        resetForm();
        rects.hide();
        return;
    }

    if (!count_result(firstValue, secondValue)){
        resetForm();
        rects.hide();
        return;
    }
    
    rects.css('display', 'flex');
    firstValue < 40 ? rects.css('font-size', firstValue) : rects.css('font-size', 40)
    secondValue < 40 ? rects.css('font-size', secondValue) : rects.css('font-size', 40)
    
    $('.rects-wrap').css('height', firstValue);
    rectA.css('width', firstValue);
    rectB.css('width', secondValue);
}

function check_too_big(a, b){
    const availableWidth = $('.rects-wrap').width()
    if (parseFloat(a) + parseFloat(b) > availableWidth){return false;}
    return true;
}

function resetForm(){
    $('#first').val('');
    $('#second').val('');
    $('#res').text('');
}