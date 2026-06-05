// Variables
const emailInput = document.querySelector('.email-input');
const passwordInput = document.querySelector('.password-input');
const passwordErrorTxt = document.querySelector('.email-error-txt');
const submitButton = document.querySelector('.submit-btn');

const keyInput = document.querySelector('.key-input')
const submitKeyButton = document.querySelector('.submitkey-btn');
const PASSWORD_MAX_LENGTH = 16;
const PASSWORD_MIN_LENGTH = 10;

let emailRecieved = null;

// Functions
function validPassword(value){
    let errorString = '';
    let errorVisible = false;
    let emptyString = false;
    
    if (value){
        if (value.length < PASSWORD_MIN_LENGTH){
            errorVisible = true;
            errorString = 'Too short! Must be 10 characters minimum!';
        };

        if (value.length > PASSWORD_MAX_LENGTH){
            errorVisible = true;
            errorString += '\nToo long! Must be 16 characters maximum!';
        };
    }else{
        errorVisible = false;
        emptyString = true;
    };

    return {errorVisible, errorString, emptyString};
}

function passwordEvent(event){
    const value = event.target.value.trim();
    const results = validPassword(value);
    let errorString = results.errorString;
    let errorVisible = results.errorVisible;
    
    if (errorVisible){
        passwordErrorTxt.style.display = 'block';
        passwordErrorTxt.textContent = errorString;
    }else {
        passwordErrorTxt.style.display = 'none';
    };
};

function login(){
    fetch('/signup', {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: emailInput.value,
            password: passwordInput.value
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.passwordIssue) {
            passwordErrorTxt.style.display = 'block';
            passwordErrorTxt.textContent = data.passwordIssue;
        };

        if (data.sent || data.override){
            keyInput.style.display = 'block';
            submitKeyButton.style.display = 'block';
            submitButton.style.display = 'none';
            passwordInput.style.display = 'none';
            emailRecieved = data.email;

            passwordErrorTxt.style.display = 'block';
            passwordErrorTxt.textContent = data.override || 'Enter the activation key sent to your email.';
        };
    });
};

function sendConfirmation(key){
    fetch('/confirmLogin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            key: key,
            email: emailRecieved
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error){
            passwordErrorTxt.style.display = 'block';
            passwordErrorTxt.textContent = data.error;
        }else{
            passwordErrorTxt.style.display = 'none';
            submitKeyButton.style.display = 'none';
            window.location.href = '/dashboard';
        }
    });
};

// Events
emailInput.addEventListener('input', function(event){
    const value = event.target.value.trim();
    let errorString = '';
    let errorVisible = false;
    
    if (value){
        passwordInput.style.display = 'block';
    } else{
        passwordInput.style.display = 'none';
    }
});

submitButton.addEventListener('click', function(event){
    const results = validPassword(passwordInput.value);
    event.preventDefault();

    if (!results.errorVisible && !results.emptyString){
        login();
    };
});

submitKeyButton.addEventListener('click', function(event){
    const key = keyInput.value.trim();
    event.preventDefault();

    if (key){
        sendConfirmation(key);
    };
});

passwordInput.addEventListener('focus', passwordEvent);
passwordInput.addEventListener('blur', passwordEvent);
passwordInput.addEventListener('input', passwordEvent);

// Fetch
fetch('/api/user')
.then(res => {
    if (!res.ok){
        return null;
    }
    return res.json();
})
.then(user =>{
    if (user?._id) {
        console.log('sending')
        window.location.href = '/dashboard';
    }
});