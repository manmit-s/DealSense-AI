import random
from datetime import datetime, timedelta

def generate_usage_data():
    """Generates realistic usage_data JSON for demo accounts."""
    
    # Simulate a pattern that might be healthy or unhealthy
    is_healthy = random.choice([True, False])
    
    login_frequency = random.randint(10, 50) if is_healthy else random.randint(0, 15)
    login_drop_pct = random.randint(0, 10) if is_healthy else random.randint(40, 80)
    
    feature_adoption = random.randint(50, 95) if is_healthy else random.randint(10, 40)
    
    ticket_sentiment = random.uniform(0.1, 0.9) if is_healthy else random.uniform(-0.8, -0.1)
    
    nps = random.randint(7, 10) if is_healthy else random.randint(2, 6)
    
    days_to_renewal = random.randint(10, 365)
    
    return {
        "login_frequency": login_frequency,
        "login_drop_pct": login_drop_pct,
        "feature_adoption": feature_adoption,
        "avg_ticket_sentiment": round(ticket_sentiment, 2),
        "nps": nps,
        "days_to_renewal": days_to_renewal,
        "last_active": (datetime.utcnow() - timedelta(days=random.randint(1, 30))).isoformat()
    }
