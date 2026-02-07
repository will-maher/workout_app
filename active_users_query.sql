-- Query to find users active in the past week
-- This query checks for users who have logged workout sets in the last 7 days

SELECT 
    u.id,
    u.username,
    u.created_at as user_created_at,
    COUNT(ws.id) as sets_logged_past_week,
    MIN(ws.created_at) as first_activity_this_week,
    MAX(ws.created_at) as last_activity_this_week
FROM users u
LEFT JOIN workout_sets ws ON u.id = ws.user_id 
    AND ws.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY u.id, u.username, u.created_at
HAVING COUNT(ws.id) > 0
ORDER BY sets_logged_past_week DESC, last_activity_this_week DESC;

-- Summary statistics
SELECT 
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN ws.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN u.id END) as active_users_past_week,
    ROUND(
        (COUNT(DISTINCT CASE WHEN ws.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN u.id END)::DECIMAL / 
         COUNT(DISTINCT u.id)) * 100, 2
    ) as active_user_percentage
FROM users u
LEFT JOIN workout_sets ws ON u.id = ws.user_id;

-- Daily activity breakdown for the past week
SELECT 
    DATE(ws.created_at) as activity_date,
    COUNT(DISTINCT ws.user_id) as unique_users,
    COUNT(ws.id) as total_sets_logged
FROM workout_sets ws
WHERE ws.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(ws.created_at)
ORDER BY activity_date DESC;
