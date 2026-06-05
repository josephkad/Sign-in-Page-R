// Variables
const user_txt = document.querySelector('.user-txt');
const click_btn = document.querySelector('.click-btn');
let clicks = 0

// Main
fetch('/api/user')
.then(res => res.json())
.then(user =>{
    if (!user){
        window.location.href = '/index.html';
        return;
    }

    user_txt.innerHTML = 'Welcome ' + user.displayName + '!';
    click_btn.innerHTML = 'Increase Clicks: ' + user.clicks;
    clicks = user.clicks || 0;
});

click_btn.addEventListener('click', function(){
    clicks++;
    click_btn.innerHTML = 'Increase Clicks: ' + clicks;
    
    fetch('/api/clicks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            clicks: clicks
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log(data);
    })
});