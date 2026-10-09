-- TDPCS-Apt Seed Data

-- Products
insert into products(name, minutes, sort_order) values
 ('Simple Loan',20,1),
 ('Emergency Loan',5,2),
 ('Education Loan',5,3),
 ('Professional Edu. Loan',15,4),
 ('Vehicle Loan',20,5),
 ('Hire Purchase Loan',15,6),
 ('Chitty Prized Withdrawal',10,7)
on conflict do nothing;

-- Settings
insert into settings (key, value) values
 ('slot_step','5'),
 ('report_buffer','10'),
 ('max_extension','30'),
 ('advance_days','15'),
 ('client_notify_number',''),
 ('n8n_webhook_url','')
on conflict (key) do nothing;

-- Open Days: Tuesdays and Thursdays (10:00-13:00, 14:00-17:00)
insert into open_days(day, s1_start, s1_end, s2_start, s2_end)
select d::date, '10:00','13:00','14:00','17:00'
  from generate_series(current_date, current_date + 15, '1 day') d
 where extract(isodow from d) in (2,4)
on conflict (day) do nothing;

-- Open Days: Saturdays (10:00-12:30 single session)
insert into open_days(day, s1_start, s1_end)
select d::date, '10:00','12:30'
  from generate_series(current_date, current_date + 15, '1 day') d
 where extract(isodow from d) = 6
on conflict (day) do nothing;
