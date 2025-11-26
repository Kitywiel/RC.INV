// Contact Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.querySelector('.contact-form');
    const submitBtn = document.querySelector('.btn-submit');
    
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form values
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const subject = document.getElementById('subject').value;
        const message = document.getElementById('message').value;
        
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        
        try {
            // Send to server
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, subject, message })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Success
                alert('Message sent successfully! We will get back to you soon.');
                contactForm.reset();
            } else {
                // Error
                alert(data.error || 'Failed to send message. Please try again.');
            }
        } catch (error) {
            alert('Connection error. Please make sure the server is running.');
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Message';
        }
    });
});