-- Drop existing tables and types if they exist to prevent conflicts
DROP TABLE IF EXISTS incidents, stations CASCADE;
DROP TYPE IF EXISTS operational_status, incident_status, incident_severity CASCADE;

-- Create Enums for Statuses and Severities
CREATE TYPE operational_status AS ENUM ('normal', 'degraded', 'offline');
CREATE TYPE incident_status AS ENUM ('new', 'acknowledged', 'in_progress', 'resolved', 'closed');
CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Create Stations Table
CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    province VARCHAR(100),
    district VARCHAR(100),
    sub_district VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    sea_level DOUBLE PRECISION,
    pole_height DOUBLE PRECISION,
    position VARCHAR(100),
    operational_status operational_status DEFAULT 'normal'::operational_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Incidents Table
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID REFERENCES stations(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status incident_status DEFAULT 'new'::incident_status NOT NULL,
    severity incident_severity DEFAULT 'medium'::incident_severity NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Indexes for performance
CREATE INDEX idx_stations_code ON stations(code);
CREATE INDEX idx_incidents_station_id ON incidents(station_id);
CREATE INDEX idx_incidents_status ON incidents(status);

-- Enable Row-Level Security (RLS)
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Create Policies for Authenticated Operations Operators
CREATE POLICY "Allow select for authenticated operators" ON stations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow select for authenticated operators" ON incidents
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow update status for authenticated operators" ON incidents
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Create auto-update triggers for updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
